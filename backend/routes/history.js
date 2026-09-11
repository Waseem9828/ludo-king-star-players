import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import Transaction, { TRANSACTION_TYPE } from "../models/Transaction.js";
import Withdrawal from "../models/Withdrawal.js";
import Match from "../models/Match.js";

const router = Router();

router.use(requireAuth);

const GAME_TRANSACTION_TYPES = [
  TRANSACTION_TYPE.BATTLE_ENTRY,
  TRANSACTION_TYPE.BATTLE_PRIZE,
  TRANSACTION_TYPE.BATTLE_REFUND,
];

const CATEGORY_TYPES = {
  deposit: [
    TRANSACTION_TYPE.WALLET_TOPUP,
    TRANSACTION_TYPE.ADMIN_BONUS,
    TRANSACTION_TYPE.ADMIN_PENALTY,
    TRANSACTION_TYPE.ADMIN_ADJUSTMENT,
    TRANSACTION_TYPE.MANUAL_DEPOSIT,
    TRANSACTION_TYPE.SYSTEM_ERROR_COMPENSATION,
    TRANSACTION_TYPE.BATTLE_ERROR_REFUND,
    TRANSACTION_TYPE.WELCOME_BONUS,
    TRANSACTION_TYPE.PROMO_BONUS,
    TRANSACTION_TYPE.TOURNAMENT_PRIZE
  ],
  referral: [
    TRANSACTION_TYPE.REFERRAL_BONUS,
    TRANSACTION_TYPE.MATCH_REFERRAL_COMMISSION
  ],
};

function clampLimit(raw, fallback = 50) {
  return Math.min(Math.max(Number(raw) || fallback, 1), 100);
}

import { paginateWithCursor } from "../utils/cursorPagination.js";

async function withdrawalHistory(userId, limit, cursor) {
  const filter = { user: userId };
  const paginated = await paginateWithCursor(Withdrawal, filter, { limit, cursor });
  const items = paginated.items.map((w) => ({
    id: w._id,
    type: "WITHDRAWAL",
    category: "withdraw",
    amount: -w.amount,
    status: w.status,
    reference: w._id,
    description: w.payoutMethod === "upi" ? `UPI · ${w.payoutDetails?.upiId || ""}` : "Bank transfer",
    date: w.createdAt,
  }));
  return { items, nextCursor: paginated.nextCursor, hasMore: paginated.hasMore };
}

async function transactionHistory(userId, types, limit, cursor) {
  const filter = { user: userId };
  if (types) filter.type = { $in: types };
  else filter.type = { $nin: GAME_TRANSACTION_TYPES };

  const paginated = await paginateWithCursor(Transaction, filter, { limit, cursor });
  const items = paginated.items.map((tx) => ({
    id: tx._id,
    type: tx.type,
    category: tx.amount >= 0 ? "credit" : "debit",
    amount: tx.amount,
    status: "completed",
    reference: tx._id,
    description: tx.note,
    date: tx.createdAt,
  }));
  return { items, nextCursor: paginated.nextCursor, hasMore: paginated.hasMore };
}

// GET /api/history?category=deposit|bonus|withdraw&limit=&cursor=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = clampLimit(req.query.limit);
    const cursor = req.query.cursor;
    const { category } = req.query;

    if (category === "withdraw") {
      return res.json(await withdrawalHistory(req.user.id, limit, cursor));
    }
    if (category && CATEGORY_TYPES[category]) {
      return res.json(await transactionHistory(req.user.id, CATEGORY_TYPES[category], limit, cursor));
    }
    return res.json(await transactionHistory(req.user.id, null, limit, cursor));
  })
);

// GET /api/history/games — battle history with cursor pagination
router.get(
  "/games",
  asyncHandler(async (req, res) => {
    const limit = clampLimit(req.query.limit);
    const cursor = req.query.cursor;
    const userId = req.user.id;

    const filter = { $or: [{ creator: userId }, { opponent: userId }] };
    const paginated = await paginateWithCursor(Match, filter, {
      limit,
      cursor,
      populate: [
        { path: "creator", select: "name" },
        { path: "opponent", select: "name" },
        { path: "winner", select: "name" },
      ],
    });

    const items = paginated.items.map((match) => {
      const isCreator = match.creator?._id?.toString() === userId;
      const opponent = isCreator ? match.opponent : match.creator;

      let result = "PENDING";
      if (match.status === "CANCELLED") result = "CANCELLED";
      else if (match.status === "REFUNDED") result = "REFUNDED";
      else if (match.status === "SETTLED" || match.status === "COMPLETED") {
        result = match.winner?._id?.toString() === userId ? "WIN" : "LOSS";
      }

      return {
        id: match._id,
        roomCode: match.roomCode,
        status: match.status,
        result,
        entryCoins: match.entryCoins,
        prizeCoins: match.prizeCoins,
        opponent: opponent?.name || null,
        date: match.createdAt,
      };
    });

    res.json({ items, nextCursor: paginated.nextCursor, hasMore: paginated.hasMore });
  })
);

export default router;
