import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireFields } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import User from "../models/User.js";
import Match, { MATCH_STATUS } from "../models/Match.js";
import Withdrawal from "../models/Withdrawal.js";
import Transaction, { TRANSACTION_TYPE } from "../models/Transaction.js";

const router = Router();

router.use(requireAuth);

// GET /api/users/me/stats — Account tab summary numbers.
router.get(
  "/me/stats",
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const [battlesPlayed, depositAgg, withdrawalAgg, referralAgg] = await Promise.all([
      Match.countDocuments({
        status: { $in: [MATCH_STATUS.COMPLETED, MATCH_STATUS.SETTLED] },
        $or: [{ creator: userId }, { opponent: userId }],
      }),
      Transaction.aggregate([
        { $match: { user: userObjectId, type: TRANSACTION_TYPE.WALLET_TOPUP } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Withdrawal.aggregate([
        { $match: { user: userObjectId, status: "approved" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Transaction.aggregate([
        {
          $match: {
            user: userObjectId,
            type: { $in: [TRANSACTION_TYPE.REFERRAL_BONUS, TRANSACTION_TYPE.MATCH_REFERRAL_COMMISSION] },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    res.json({
      battlesPlayed,
      totalDeposit: depositAgg[0]?.total || 0,
      totalWithdrawal: withdrawalAgg[0]?.total || 0,
      referralEarnings: referralAgg[0]?.total || 0,
    });
  })
);

// PATCH /api/users/me — currently supports editing display name only (no
// avatar upload infra exists). Phone/role/status are never editable here.
router.patch(
  "/me",
  requireFields("name"),
  asyncHandler(async (req, res) => {
    const name = String(req.body.name).trim();
    if (!name) {
      return res.status(400).json({ message: "Name cannot be empty" });
    }
    if (name.length > 60) {
      return res.status(400).json({ message: "Name must be 60 characters or fewer" });
    }

    const user = await User.findByIdAndUpdate(req.user.id, { name }, { new: true });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      id: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      status: user.status,
      referralCode: user.referralCode,
    });
  })
);

export default router;
