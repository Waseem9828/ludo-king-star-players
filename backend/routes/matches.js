import { Router } from "express";
import { requireAuth, requireActiveWallet } from "../middleware/authMiddleware.js";
import { requireAnyAdmin } from "../middleware/roleMiddleware.js";
import { requireFields } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deductCoins, creditCoins } from "../utils/coinLedger.js";
import { calculatePrizeCoins } from "../utils/prizeCalculator.js";
import { MIN_ENTRY_COINS, MAX_ENTRY_COINS } from "../config/gameConfig.js";
import Match, { MATCH_STATUS } from "../models/Match.js";
import { TRANSACTION_TYPE } from "../models/Transaction.js";
import User from "../models/User.js";
import ReferralSettings from "../models/ReferralSettings.js";
import { getReferralSettings } from "../utils/referralSettings.js";
import ReferralCommission from "../models/ReferralCommission.js";
import Referral from "../models/Referral.js";
import { notifyUser } from "../utils/notify.js";
import { NOTIFICATION_TYPE } from "../models/Notification.js";
import { MAX_IMAGE_DATA_URI_LENGTH, isValidImageDataUri } from "../config/uploadConfig.js";
import { getSiteSettings } from "../utils/siteSettings.js";
import fetch from "node-fetch";

const router = Router();

function isParticipant(match, userId) {
  return (
    match.creator?._id?.toString() === userId ||
    match.creator?.toString?.() === userId ||
    match.opponent?._id?.toString() === userId ||
    match.opponent?.toString?.() === userId
  );
}

// Helper to check if a user is currently playing or waiting in an active running match
async function getActiveOngoingBattle(userId) {
  return await Match.findOne({
    $or: [{ creator: userId }, { opponent: userId }],
    status: {
      $in: [
        MATCH_STATUS.JOINED,
        MATCH_STATUS.ACCEPTED,
        MATCH_STATUS.ROOM_SHARED,
        MATCH_STATUS.PLAYING,
        MATCH_STATUS.RESULT_SUBMITTED,
        MATCH_STATUS.DISPUTED,
      ],
    },
  });
}

// Referral commission — paid by the PLATFORM from the fee we collect,
// NOT deducted from the winner's wallet.
export async function processReferralCommission(winnerId, match, prizeCoins) {
  try {
    const winnerUser = await User.findById(winnerId);
    if (winnerUser && winnerUser.referredBy) {
      const settings = await getReferralSettings();
      if (settings && settings.commissionEnabled && settings.commissionPercentage > 0) {
        // Commission base is the winning amount (prizeCoins)
        let commissionAmount = (prizeCoins * settings.commissionPercentage) / 100;
        if (settings.maxCommissionAmount > 0) {
          commissionAmount = Math.min(commissionAmount, settings.maxCommissionAmount);
        }
        commissionAmount = Math.floor(commissionAmount);

        if (commissionAmount > 0) {
          // Credit referrer from platform — creating coins (platform absorbs the cost)
          // As per coinLedger.js, MATCH_REFERRAL_COMMISSION is correctly mapped to depositCoins,
          // so it cannot be directly withdrawn.
          await creditCoins(winnerUser.referredBy, commissionAmount, {
            type: TRANSACTION_TYPE.MATCH_REFERRAL_COMMISSION,
            match: match._id,
            note: `Referral commission (${settings.commissionPercentage}% of winning amount) — referred user won a match`,
          });

          await ReferralCommission.create({
            referrer: winnerUser.referredBy,
            referredUser: winnerId,
            match: match._id,
            baseAmount: prizeCoins,
            commissionPercent: settings.commissionPercentage,
            commissionAmount: commissionAmount,
            status: "CREDITED",
          });

          // Update the Referral document so the frontend shows how much they earned from this user
          await Referral.findOneAndUpdate(
            { referrer: winnerUser.referredBy, referredUser: winnerId },
            { $inc: { referrerRewardCoins: commissionAmount } }
          );
        }
      }
    }
  } catch (err) {
    console.error("Error processing referral commission:", err);
  }
}

export async function cleanupExpiredWaitingMatches() {
  try {
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    
    // Find all matches in WAITING status older than 3 minutes with no opponent
    const expiredMatches = await Match.find({
      status: MATCH_STATUS.WAITING,
      opponent: null,
      createdAt: { $lt: threeMinutesAgo }
    });

    for (const match of expiredMatches) {
      // Atomic state transition to CANCELLED to prevent duplicate refund race conditions
      const cancelledMatch = await Match.findOneAndUpdate(
        { _id: match._id, status: MATCH_STATUS.WAITING, opponent: null },
        { $set: { status: MATCH_STATUS.CANCELLED, cancelReason: "Auto-cancelled after 3 minutes (no opponent joined)" } },
        { new: true }
      );

      if (cancelledMatch) {
        // Refund coins to creator
        await creditCoins(cancelledMatch.creator, cancelledMatch.entryCoins, {
          type: TRANSACTION_TYPE.BATTLE_REFUND,
          match: cancelledMatch._id,
          note: "Refund: battle auto-cancelled after 3 minutes",
        });

        await notifyUser(cancelledMatch.creator, {
          type: NOTIFICATION_TYPE.MATCH_CANCELLED,
          title: "Battle Auto-Cancelled",
          message: "Your battle was automatically cancelled because no opponent joined within 3 minutes. Coins refunded.",
          match: cancelledMatch._id,
        });

        notifyLobby("match:cancelled", { matchId: cancelledMatch._id });
        notifyMatch(cancelledMatch._id, "match:cancelled", cancelledMatch);
      }
    }
  } catch (err) {
    console.error("Error cleaning up expired waiting matches:", err);
  }
}

// Run background worker every 15 seconds to ensure 100% refund reliability across server restarts
setInterval(cleanupExpiredWaitingMatches, 15000);

import { notifyLobby, notifyMatch } from "../config/socket.js";
import redisWrapper from "../config/redis.js";

// GET /api/matches/open
router.get("/open", asyncHandler(async (req, res) => {
  const cacheKey = "matches:open";
  const cached = await redisWrapper.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const matches = await Match.find({ status: MATCH_STATUS.WAITING })
    .populate("creator", "name")
    .sort({ createdAt: -1 })
    .lean();

  await redisWrapper.set(cacheKey, matches, 3); // 3 second TTL cache
  res.json(matches);
}));

// GET /api/matches/running
router.get("/running", asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
  const matches = await Match.find({ 
    status: { $in: [
      MATCH_STATUS.JOINED, 
      MATCH_STATUS.ACCEPTED, 
      MATCH_STATUS.ROOM_SHARED, 
      MATCH_STATUS.PLAYING, 
      MATCH_STATUS.RESULT_SUBMITTED, 
      MATCH_STATUS.DISPUTED
    ]} 
  })
    .populate("creator", "name")
    .populate("opponent", "name")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  res.json(matches);
}));

// GET /api/matches/mine
router.get("/mine", requireAuth, asyncHandler(async (req, res) => {
  const matches = await Match.find({
    $or: [{ creator: req.user.id }, { opponent: req.user.id }],
  })
    .populate("creator", "name")
    .populate("opponent", "name")
    .populate("winner", "name")
    .populate("loser", "name")
    .sort({ createdAt: -1 })
    .lean();
  res.json(matches);
}));

// POST /api/matches
router.post("/", requireAuth, requireActiveWallet, asyncHandler(async (req, res) => {
  await cleanupExpiredWaitingMatches();
  const rawEntryCoins = req.body?.entryCoins;
  const entryCoins = Number(rawEntryCoins);

  if (!Number.isFinite(entryCoins) || !Number.isInteger(entryCoins) || entryCoins <= 0) {
    return res.status(400).json({ message: "Please enter a valid entry amount." });
  }
  if (entryCoins < MIN_ENTRY_COINS || entryCoins > MAX_ENTRY_COINS) {
    return res.status(400).json({ message: `Entry amount must be between ${MIN_ENTRY_COINS} and ${MAX_ENTRY_COINS} coins.` });
  }

  // Prevent user from creating a battle if they have an active running battle in progress
  const ongoingBattle = await getActiveOngoingBattle(req.user.id);
  if (ongoingBattle) {
    return res.status(400).json({
      message: "You already have a battle in progress! Please complete your running battle by declaring your result (I Won / I Lost) first.",
      activeBattleId: ongoingBattle._id,
    });
  }

  // A user can create up to 3 open battles with different amounts
  const myOpenBattles = await Match.find({ creator: req.user.id, status: MATCH_STATUS.WAITING });
  if (myOpenBattles.length >= 3) {
    return res.status(400).json({ message: "You can create up to 3 open battles at a time." });
  }

  const existsWithSameAmount = myOpenBattles.some((m) => m.entryCoins === entryCoins);
  if (existsWithSameAmount) {
    return res.status(400).json({ message: `You already have an open battle for ${entryCoins} coins. Please choose a different amount.` });
  }

  const payer = await deductCoins(req.user.id, entryCoins, {
    type: TRANSACTION_TYPE.BATTLE_ENTRY,
    note: "Battle entry (creator)",
  });
  if (!payer) {
    return res.status(400).json({ message: "Insufficient coin balance" });
  }

  const prizeCoins = calculatePrizeCoins(entryCoins, 2);

  let match;
  try {
    match = await Match.create({
      creator: req.user.id,
      entryCoins,
      prizeCoins,
      status: MATCH_STATUS.WAITING,
    });
  } catch (err) {
    // Rollback: refund coins if match creation fails
    await creditCoins(req.user.id, entryCoins, {
      type: TRANSACTION_TYPE.BATTLE_REFUND,
      note: "Refund: Battle creation failed due to server error",
    });
    throw err;
  }

  // Auto-cancel timer backup after 3 minutes if still WAITING
  setTimeout(() => {
    cleanupExpiredWaitingMatches().catch(console.error);
  }, 3 * 60 * 1000 + 500);

  await match.populate("creator", "name");
  await redisWrapper.del("matches:open");
  notifyLobby("match:created", match);
  res.status(201).json(match);
}));

// GET /api/matches/:id
router.get("/:id", requireAuth, asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id)
    .populate("creator", "name")
    .populate("opponent", "name")
    .populate("winner", "name")
    .populate("loser", "name")
    .populate("resultProof.user", "name");

  if (!match) return res.status(404).json({ message: "Match not found" });

  const isAdmin = ["admin", "owner"].includes(req.user.role);
  if (match.status !== MATCH_STATUS.WAITING && !isParticipant(match, req.user.id) && !isAdmin) {
    return res.status(403).json({ message: "You do not have access to this match" });
  }

  res.json(match);
}));

// POST /api/matches/:id/join
router.post("/:id/join", requireAuth, requireActiveWallet, asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);
  if (!match) return res.status(404).json({ message: "Match not found" });

  if (match.creator.toString() === req.user.id) {
    return res.status(400).json({ message: "You cannot join your own battle" });
  }
  if (match.status !== MATCH_STATUS.WAITING || match.opponent) {
    return res.status(400).json({ message: "This battle is no longer open to join" });
  }

  // Prevent user from joining a battle if they are already in an active running battle
  const ongoingBattle = await getActiveOngoingBattle(req.user.id);
  if (ongoingBattle) {
    return res.status(400).json({
      message: "You already have a battle in progress! Please complete your running battle by declaring your result (I Won / I Lost) before joining another.",
      activeBattleId: ongoingBattle._id,
    });
  }

  const payer = await deductCoins(req.user.id, match.entryCoins, {
    type: TRANSACTION_TYPE.BATTLE_ENTRY,
    match: match._id,
    note: "Battle entry (opponent)",
  });
  if (!payer) return res.status(400).json({ message: "Insufficient coin balance" });

  const updated = await Match.findOneAndUpdate(
    { _id: match._id, status: MATCH_STATUS.WAITING, opponent: null },
    { $set: { opponent: req.user.id, status: MATCH_STATUS.JOINED } },
    { new: true }
  );

  if (!updated) {
    await creditCoins(req.user.id, match.entryCoins, {
      type: TRANSACTION_TYPE.BATTLE_REFUND,
      match: match._id,
      note: "Refund: battle was filled by another player",
    });
    return res.status(409).json({ message: "This battle was just filled by another player" });
  }

  // Auto-cancel all OTHER open battles created by the host OR the opponent,
  // since players can only be involved in 1 battle at a time.
  const otherOpenBattles = await Match.find({
    creator: { $in: [updated.creator, updated.opponent] },
    _id: { $ne: updated._id },
    status: MATCH_STATUS.WAITING,
  });

  for (const otherMatch of otherOpenBattles) {
    otherMatch.status = MATCH_STATUS.CANCELLED;
    await otherMatch.save();

    await creditCoins(otherMatch.creator, otherMatch.entryCoins, {
      type: TRANSACTION_TYPE.BATTLE_REFUND,
      match: otherMatch._id,
      note: `Auto-refund: another battle (${updated.entryCoins} coins) was joined by a player`,
    });

    await notifyUser(otherMatch.creator, {
      type: NOTIFICATION_TYPE.MATCH_CANCELLED,
      title: "Other Battle Auto-Cancelled",
      message: `Your ${otherMatch.entryCoins} coins battle was automatically cancelled & refunded because your ${updated.entryCoins} coins battle was joined by a player.`,
      match: otherMatch._id,
    });
  }

  await notifyUser(updated.creator, {
    type: NOTIFICATION_TYPE.MATCH_JOINED,
    title: "Opponent Joined!",
    message: "An opponent has joined your battle. Please accept them to continue.",
    match: updated._id,
  });

  await updated.populate("creator", "name");
  await updated.populate("opponent", "name");
  await redisWrapper.del("matches:open");
  notifyLobby("match:joined", updated);
  notifyMatch(updated._id, "match:joined", updated);
  res.json(updated);
}));


// POST /api/matches/:id/accept
router.post("/:id/accept", requireAuth, asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);
  if (!match) return res.status(404).json({ message: "Match not found" });
  
  if (match.creator.toString() !== req.user.id) {
    return res.status(403).json({ message: "Only the creator can accept the opponent" });
  }
  if (match.status !== MATCH_STATUS.JOINED) {
    return res.status(400).json({ message: "Match is not in JOINED status" });
  }

  match.status = MATCH_STATUS.ACCEPTED;
  await match.save();
  await match.populate("creator", "name");
  await match.populate("opponent", "name");
  notifyMatch(match._id, "match:updated", match);
  res.json(match);
}));

// POST /api/matches/:id/room-code
router.post("/:id/room-code", requireAuth, requireFields("roomCode"), asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);
  if (!match) return res.status(404).json({ message: "Match not found" });
  
  if (match.creator.toString() !== req.user.id) {
    return res.status(403).json({ message: "Only the creator can share the room code" });
  }
  if (match.status !== MATCH_STATUS.ACCEPTED && match.status !== MATCH_STATUS.ROOM_SHARED) {
    return res.status(400).json({ message: "Match must be ACCEPTED to share room code" });
  }

  const roomCode = String(req.body.roomCode).trim();
  if (!/^[0]\d{7}$/.test(roomCode)) {
    return res.status(400).json({ message: "Room code must be exactly 8 digits and start with 0" });
  }

  const settings = await getSiteSettings();

  if (settings.ludoRoomApiKey) {
    try {
      const roomCheckRes = await fetch("https://ludoroom.in/api/v1/ludoking/roomtype", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": settings.ludoRoomApiKey
        },
        body: JSON.stringify({ roomCode, json: false })
      });
      
      const roomCheckData = await roomCheckRes.json();
      
      if (!roomCheckRes.ok && roomCheckRes.status !== 402) { // 402 is insufficient credits, fallback to manual
        return res.status(400).json({ message: roomCheckData.msg || roomCheckData.message || "Invalid room code." });
      }
      
      if (roomCheckRes.ok) {
        if (roomCheckData.status === false) {
          return res.status(400).json({ message: roomCheckData.msg || "Invalid or expired room code." });
        }
        if (String(roomCheckData.table_status).toLowerCase() !== "waiting") {
          return res.status(400).json({ message: `Room is not waiting. Current status: ${roomCheckData.table_status}` });
        }
      }
    } catch (err) {
      console.error("Failed to check LudoRoom type:", err);
      // Proceeding with manual fallback if API fails
    }
  }

  match.roomCode = roomCode;
  match.status = MATCH_STATUS.ROOM_SHARED;
  if (!match.roomCodeSharedAt) {
    match.roomCodeSharedAt = new Date();
  }
  await match.save();
  await match.populate("creator", "name");
  await match.populate("opponent", "name");
  notifyMatch(match._id, "match:updated", match);
  res.json(match);

  // Trigger LudoRoom API in background if enabled
  // Trigger LudoRoom API in background if enabled
  try {
    if (settings.ludoRoomApiKey) {
      fetch("https://ludoroom.in/api/v1/ludoking/result", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": settings.ludoRoomApiKey
        },
        body: JSON.stringify({ roomCode, json: true })
      }).catch(err => console.error("LudoRoom API Error:", err));
    }
  } catch (err) {
    console.error("Failed to trigger LudoRoom API:", err);
  }
}));

// POST /api/matches/:id/cancel
router.post("/:id/cancel", requireAuth, asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);
  if (!match) return res.status(404).json({ message: "Match not found" });

  const isAdmin = ["admin", "owner", "master", "finance_admin"].includes(req.user.role);
  if (!isParticipant(match, req.user.id) && !isAdmin) {
    return res.status(403).json({ message: "You are not allowed to cancel this battle" });
  }

  const uncancelable = [
    MATCH_STATUS.RESULT_SUBMITTED,
    MATCH_STATUS.COMPLETED,
    MATCH_STATUS.DISPUTED,
    MATCH_STATUS.CANCELLED,
    MATCH_STATUS.REFUNDED,
    MATCH_STATUS.SETTLED,
  ];

  const hasOpponent = Boolean(match.opponent);
  const targetStatus = hasOpponent ? MATCH_STATUS.REFUNDED : MATCH_STATUS.CANCELLED;
  const cancelReason = req.body?.reason ? String(req.body.reason).trim() : "";

  // Atomic state transition: ensures only one concurrent cancel succeeds
  const cancelledMatch = await Match.findOneAndUpdate(
    { _id: match._id, status: { $nin: uncancelable } },
    { $set: { status: targetStatus, ...(cancelReason ? { cancelReason } : {}) } },
    { new: true }
  );

  if (!cancelledMatch) {
    return res.status(400).json({ message: "Match cannot be cancelled at this stage or has already been resolved." });
  }

  // Refund creator (idempotent reference guarantees no duplicate refund)
  await creditCoins(cancelledMatch.creator, cancelledMatch.entryCoins, {
    type: TRANSACTION_TYPE.BATTLE_REFUND,
    match: cancelledMatch._id,
    note: `Refund: battle cancelled${cancelledMatch.cancelReason ? ` (${cancelledMatch.cancelReason})` : ""}`,
    reference: `battle_refund_creator:${cancelledMatch._id}`,
  });

  // Refund opponent if joined
  if (hasOpponent && cancelledMatch.opponent) {
    await creditCoins(cancelledMatch.opponent, cancelledMatch.entryCoins, {
      type: TRANSACTION_TYPE.BATTLE_REFUND,
      match: cancelledMatch._id,
      note: `Refund: battle cancelled${cancelledMatch.cancelReason ? ` (${cancelledMatch.cancelReason})` : ""}`,
      reference: `battle_refund_opponent:${cancelledMatch._id}`,
    });
    
    // Notify the other player
    const otherPlayer = req.user.id === cancelledMatch.creator.toString() ? cancelledMatch.opponent : cancelledMatch.creator;
    await notifyUser(otherPlayer, {
      type: NOTIFICATION_TYPE.MATCH_CANCELLED,
      title: "Match Cancelled",
      message: `The match was cancelled${cancelledMatch.cancelReason ? ` (${cancelledMatch.cancelReason})` : ""} and your entry coins have been refunded.`,
      match: cancelledMatch._id,
    });
  }

  notifyLobby("match:cancelled", { matchId: cancelledMatch._id });
  notifyMatch(cancelledMatch._id, "match:cancelled", cancelledMatch);

  res.json(cancelledMatch);
}));

// POST /api/matches/:id/result-proof
router.post("/:id/result-proof", requireAuth, requireFields("claimedResult"), asyncHandler(async (req, res) => {
  const { claimedResult } = req.body;
  const imageUrl = req.body.imageUrl || "";
  if (!["WIN", "LOSS"].includes(claimedResult)) {
    return res.status(400).json({ message: "claimedResult must be 'WIN' or 'LOSS'" });
  }
  if (claimedResult === "WIN" || imageUrl) {
    if (!isValidImageDataUri(imageUrl)) {
      return res.status(400).json({ message: "Screenshot must be a valid image" });
    }
    if (imageUrl.length > MAX_IMAGE_DATA_URI_LENGTH) {
      return res.status(400).json({ message: "Screenshot is too large." });
    }
  }

  const match = await Match.findById(req.params.id);
  if (!match) return res.status(404).json({ message: "Match not found" });
  
  const isCreator = match.creator.toString() === req.user.id;
  const isOpponent = match.opponent?.toString() === req.user.id;
  if (!isCreator && !isOpponent) {
    return res.status(403).json({ message: "Only players can submit results" });
  }

  const allowedStatuses = [MATCH_STATUS.ROOM_SHARED, MATCH_STATUS.PLAYING, MATCH_STATUS.RESULT_SUBMITTED];
  if (!allowedStatuses.includes(match.status)) {
    return res.status(400).json({ message: "Cannot submit results right now" });
  }

  // Prevent duplicate submissions by the same user
  if (isCreator && match.creatorResult) {
     return res.status(400).json({ message: "You have already submitted a result." });
  }
  if (isOpponent && match.opponentResult) {
     return res.status(400).json({ message: "You have already submitted a result." });
  }

  const newCreatorResult = isCreator ? claimedResult : match.creatorResult;
  const newOpponentResult = isOpponent ? claimedResult : match.opponentResult;

  let newStatus = MATCH_STATUS.RESULT_SUBMITTED;
  let winner = null;
  let loser = null;

  // Automation Check
  if (claimedResult === "LOSS") {
    if (isCreator) {
      winner = match.opponent;
      loser = match.creator;
    } else {
      winner = match.creator;
      loser = match.opponent;
    }
    newStatus = MATCH_STATUS.SETTLED;
  } else if (newCreatorResult && newOpponentResult) {
    if (newCreatorResult === "WIN" && newOpponentResult === "LOSS") {
      winner = match.creator;
      loser = match.opponent;
      newStatus = MATCH_STATUS.SETTLED;
    } else if (newCreatorResult === "LOSS" && newOpponentResult === "WIN") {
      winner = match.opponent;
      loser = match.creator;
      newStatus = MATCH_STATUS.SETTLED;
    } else {
      newStatus = MATCH_STATUS.DISPUTED;
    }
  }

  const newProof = {
    user: req.user.id,
    imageUrl,
    claimedResult,
    submittedAt: new Date(),
  };

  // Atomic findOneAndUpdate to prevent duplicate payout or concurrent race conditions
  const updatedMatch = await Match.findOneAndUpdate(
    {
      _id: match._id,
      status: { $in: allowedStatuses },
    },
    {
      $push: { resultProof: newProof },
      $set: {
        creatorResult: newCreatorResult,
        opponentResult: newOpponentResult,
        status: newStatus,
        ...(winner ? { winner, loser } : {}),
      },
    },
    { new: true }
  );

  if (!updatedMatch) {
    return res.status(409).json({ message: "Match result was already submitted or settled by another action." });
  }

  if (updatedMatch.status === MATCH_STATUS.SETTLED && updatedMatch.winner) {
    const pool = updatedMatch.entryCoins * 2;
    const platformFeeCoins = pool - updatedMatch.prizeCoins;

    await creditCoins(updatedMatch.winner, updatedMatch.prizeCoins, {
      type: TRANSACTION_TYPE.BATTLE_PRIZE,
      match: updatedMatch._id,
      note: `Battle prize payout (pool: ${pool}, platform fee: ${platformFeeCoins})`,
      reference: `battle_prize:${updatedMatch._id}`,
    });

    // Referral commission is calculated on the winning amount (prizeCoins)
    await processReferralCommission(updatedMatch.winner, updatedMatch, updatedMatch.prizeCoins);

    await notifyUser(updatedMatch.winner, {
      type: NOTIFICATION_TYPE.MATCH_WON,
      title: "You won!",
      message: `You won ${updatedMatch.prizeCoins} coins.`,
      match: updatedMatch._id,
    });
    await notifyUser(updatedMatch.loser, {
      type: NOTIFICATION_TYPE.MATCH_LOST,
      title: "Battle result",
      message: `You lost the battle. Better luck next time!`,
      match: updatedMatch._id,
    });
  }

  notifyMatch(updatedMatch._id, "match:updated", updatedMatch);
  notifyLobby("match:updated", updatedMatch);

  res.status(201).json(updatedMatch);
}));

export default router;
