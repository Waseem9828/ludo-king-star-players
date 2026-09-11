import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import Match, { MATCH_STATUS } from "../models/Match.js";
import { notifyUser } from "../utils/notify.js";
import { notifyMatch } from "../config/socket.js";
import { creditCoins } from "../utils/coinLedger.js";
import { TRANSACTION_TYPE } from "../models/Transaction.js";
import { NOTIFICATION_TYPE } from "../models/Notification.js";
import { processReferralCommission } from "./matches.js";

const router = Router();

import { getSiteSettings } from "../utils/siteSettings.js";

// POST /api/webhooks/ludoroom
router.post("/ludoroom", asyncHandler(async (req, res) => {
  const settings = await getSiteSettings();
  const configuredSecret = process.env.LUDOROOM_WEBHOOK_SECRET || settings?.ludoRoomApiKey;

  // If secret is configured, require it in headers or query
  if (configuredSecret) {
    const providedSecret = req.headers["x-api-key"] || req.headers["x-webhook-secret"] || req.query.secret;
    if (!providedSecret || providedSecret !== configuredSecret) {
      console.warn("Unauthorized LudoRoom webhook call attempt blocked.");
      return res.status(401).json({ message: "Unauthorized webhook" });
    }
  }

  const payload = req.body;

  // LudoRoom API Webhook always returns 200 OK immediately
  res.status(200).json({ received: true });

  // Only care about finished events
  if (payload?.event !== "finished" || !payload.details || payload.details.milestone !== "win_loss") {
    return;
  }

  const roomCode = String(payload.roomcode || "").trim();
  if (!roomCode) return;

  const players = payload.details.players || [];
  const jsonData = payload.json_data || {};

  // Find a match with this room code that hasn't been completed/cancelled
  const match = await Match.findOne({
    roomCode: roomCode,
    status: { $in: [MATCH_STATUS.ROOM_SHARED, MATCH_STATUS.PLAYING, MATCH_STATUS.RESULT_SUBMITTED, MATCH_STATUS.DISPUTED] }
  }).sort({ createdAt: -1 }).populate("creator", "name").populate("opponent", "name");

  if (!match || !match.creator || !match.opponent) return;

  // Figure out who won based on Ludo King IDs
  const winnerSlot = players.find(p => p.status === "Won" || p.result === "WIN");
  
  let ludoWinnerName = null;
  if (winnerSlot) {
    const winnerLudoId = winnerSlot.user_id;
    if (jsonData.owner_id === winnerLudoId) {
      ludoWinnerName = jsonData.owner_name;
    } else if (jsonData.player1_id === winnerLudoId) {
      ludoWinnerName = jsonData.player1_name;
    }
  }

  const ludoRoomResult = {
    webhookAt: new Date(),
    payload: payload,
    ludoWinnerName: ludoWinnerName || "Unknown"
  };

  if (!ludoWinnerName) {
    await Match.updateOne({ _id: match._id }, { $set: { ludoRoomResult } });
    return;
  }

  const cName = match.creator.name.toLowerCase().trim();
  const oName = match.opponent.name.toLowerCase().trim();
  const lName = ludoWinnerName.toLowerCase().trim();

  let winningDbUserId = null;
  let losingDbUserId = null;
  let creatorResult = null;
  let opponentResult = null;

  if (cName === lName && oName !== lName) {
    winningDbUserId = match.creator._id;
    losingDbUserId = match.opponent._id;
    creatorResult = "WIN";
    opponentResult = "LOSS";
  } else if (oName === lName && cName !== lName) {
    winningDbUserId = match.opponent._id;
    losingDbUserId = match.creator._id;
    opponentResult = "WIN";
    creatorResult = "LOSS";
  }

  if (winningDbUserId) {
    // Atomic state transition: only succeeds if match is still in an unsettled state
    const settledMatch = await Match.findOneAndUpdate(
      {
        _id: match._id,
        status: { $in: [MATCH_STATUS.ROOM_SHARED, MATCH_STATUS.PLAYING, MATCH_STATUS.RESULT_SUBMITTED, MATCH_STATUS.DISPUTED] }
      },
      {
        $set: {
          winner: winningDbUserId,
          loser: losingDbUserId,
          creatorResult,
          opponentResult,
          status: MATCH_STATUS.SETTLED,
          ludoRoomResult,
        }
      },
      { new: true }
    );

    if (!settledMatch) {
      // Race avoided: match was already settled or refunded
      return;
    }

    // Payout
    const pool = settledMatch.entryCoins * 2;
    const platformFeeCoins = pool - settledMatch.prizeCoins;

    await creditCoins(settledMatch.winner, settledMatch.prizeCoins, {
      type: TRANSACTION_TYPE.BATTLE_PRIZE,
      match: settledMatch._id,
      note: `Auto-Settled via API (pool: ${pool}, fee: ${platformFeeCoins})`,
      reference: `ludoroom_prize:${settledMatch._id}`,
    });

    await processReferralCommission(settledMatch.winner, settledMatch, settledMatch.prizeCoins);

    await notifyUser(settledMatch.winner, {
      type: NOTIFICATION_TYPE.MATCH_WON,
      title: "You won!",
      message: `You won ${settledMatch.prizeCoins} coins. (Auto-Verified)`,
      match: settledMatch._id,
    });
    await notifyUser(settledMatch.loser, {
      type: NOTIFICATION_TYPE.MATCH_LOST,
      title: "Battle result",
      message: `You lost the battle. Better luck next time! (Auto-Verified)`,
      match: settledMatch._id,
    });

    notifyMatch(settledMatch._id, "match:updated", settledMatch);
  } else {
    // Names didn't match cleanly. Flag as Disputed for admin review.
    const disputedMatch = await Match.findOneAndUpdate(
      {
        _id: match._id,
        status: { $in: [MATCH_STATUS.ROOM_SHARED, MATCH_STATUS.PLAYING, MATCH_STATUS.RESULT_SUBMITTED] }
      },
      {
        $set: {
          status: MATCH_STATUS.DISPUTED,
          ludoRoomResult,
        }
      },
      { new: true }
    );
    if (disputedMatch) {
      notifyMatch(disputedMatch._id, "match:updated", disputedMatch);
    }
  }
}));

export default router;
