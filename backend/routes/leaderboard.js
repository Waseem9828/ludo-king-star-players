import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import Match, { MATCH_STATUS } from "../models/Match.js";
import Transaction, { TRANSACTION_TYPE } from "../models/Transaction.js";
import User from "../models/User.js";

import redisWrapper from "../config/redis.js";

const router = Router();

// GET /api/leaderboard — ranks top players by total battle winnings and total referred friends.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const cacheKey = `leaderboard:top:${limit}`;
    const cached = await redisWrapper.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const [winsAgg, winningsAgg, referralsAgg] = await Promise.all([
      Match.aggregate([
        { $match: { status: { $in: [MATCH_STATUS.COMPLETED, MATCH_STATUS.SETTLED] }, winner: { $ne: null } } },
        { $group: { _id: "$winner", battlesWon: { $sum: 1 } } },
      ]),
      Transaction.aggregate([
        { $match: { type: TRANSACTION_TYPE.BATTLE_PRIZE } },
        { $group: { _id: "$user", totalWinnings: { $sum: "$amount" } } },
      ]),
      User.aggregate([
        { $match: { referredBy: { $ne: null } } },
        { $group: { _id: "$referredBy", totalReferrals: { $sum: 1 } } },
      ]),
    ]);

    const winsMap = new Map(winsAgg.map((row) => [String(row._id), row.battlesWon]));
    const winningsMap = new Map(winningsAgg.map((row) => [String(row._id), row.totalWinnings]));
    const referralsMap = new Map(referralsAgg.map((row) => [String(row._id), row.totalReferrals]));

    // Fetch active users with winnings or referrals
    const userIds = new Set([...winsMap.keys(), ...winningsMap.keys(), ...referralsMap.keys()]);

    let users = [];
    if (userIds.size > 0) {
      users = await User.find({ _id: { $in: [...userIds] } }).select("name");
    } else {
      // Fallback to top recent users if no games/referrals yet
      users = await User.find({ status: "active" }).select("name").limit(limit);
    }

    const rows = users
      .map((user) => ({
        userId: user._id,
        name: user.name || "Player",
        battlesWon: winsMap.get(String(user._id)) || 0,
        totalWinnings: winningsMap.get(String(user._id)) || 0,
        totalReferrals: referralsMap.get(String(user._id)) || 0,
      }))
      .sort((a, b) => b.totalWinnings - a.totalWinnings || b.totalReferrals - a.totalReferrals)
      .slice(0, limit)
      .map((row, index) => ({ rank: index + 1, ...row }));

    await redisWrapper.set(cacheKey, rows, 60); // 60 second cache TTL
    res.json(rows);
  })
);

export default router;
