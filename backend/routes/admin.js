import { Router } from "express";
import mongoose from "mongoose";
import fetch from "node-fetch";
import bcrypt from "bcryptjs";
import { getProxyAgent, getProxyUrl } from "../utils/proxyAgent.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { 
  requireAnyAdmin, 
  requireMaster, 
  requireOwner, 
  requireFinance, 
  requireUserAdmin 
} from "../middleware/roleMiddleware.js";
import { requireFields } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import Match, { MATCH_STATUS } from "../models/Match.js";
import Withdrawal from "../models/Withdrawal.js";
import DepositMethod from "../models/DepositMethod.js";
import PaymentOrder, { PAYMENT_ORDER_STATUS } from "../models/PaymentOrder.js";
import { checkImbOrderStatus, isImbStatusSuccess, isImbStatusFailed } from "../utils/paymentGateway.js";
import { markPaymentOrderSuccessAndCredit } from "../utils/paymentLedger.js";
import SupportTicket from "../models/SupportTicket.js";
import Banner from "../models/Banner.js";
import Notice from "../models/Notice.js";
import Kyc from "../models/Kyc.js";
import Notification, { NOTIFICATION_TYPE } from "../models/Notification.js";
import Otp from "../models/Otp.js";
import { getOrCreateWallet, creditCoins } from "../utils/coinLedger.js";
import Transaction, { TRANSACTION_TYPE, WALLET_BUCKET } from "../models/Transaction.js";
import { STARTING_COINS, PLATFORM_FEE_PERCENT } from "../config/gameConfig.js";
import { generateReferralCode } from "../utils/roomCode.js";
import { notifyUser, notifyAllUsers } from "../utils/notify.js";
import { getReferralSettings } from "../utils/referralSettings.js";
import { getSiteSettings } from "../utils/siteSettings.js";
import { processReferralCommission } from "./matches.js";
import AdminLog from "../models/AdminLog.js";
import { logAdminAction } from "../utils/adminLogger.js";
import UserContact from "../models/UserContact.js";

const PHONE_REGEX = /^[6-9]\d{9}$/;

const ROLE_WEIGHT = {
  master: 100,
  owner: 80,
  admin: 50,
  finance_admin: 50,
  user: 10,
};

function canTargetUser(actorRole, targetRole) {
  const actorWeight = ROLE_WEIGHT[actorRole] || 0;
  const targetWeight = ROLE_WEIGHT[targetRole] || 0;
  if (actorRole === "master") return true;
  return actorWeight > targetWeight;
}

const router = Router();

router.use(requireAuth, requireAnyAdmin);

// GET /api/admin/stats
router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeUsers,
      frozenWallets,
      activeMatches,
      completedMatches,
      disputedMatches,
      pendingWithdrawals,
      verifiedKyc,
      todayDepositsAgg,
      totalDepositsAgg,
      todayWithdrawalsAgg,
      totalWithdrawalsAgg,
      appRevenueAgg,
      referralPayoutsAgg,
      dailyDepositsAgg,
      dailyWithdrawalsAgg,
      dailyMatchesAgg,
      monthlyMatchesAgg,
      monthlyReferralsAgg,
      walletSumsAgg
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: "active" }),
      User.countDocuments({ walletFrozen: true }),
      Match.countDocuments({ status: { $in: [MATCH_STATUS.OPEN, MATCH_STATUS.FULL, MATCH_STATUS.RUNNING, MATCH_STATUS.ROOM_SHARED, MATCH_STATUS.PLAYING, MATCH_STATUS.RESULT_SUBMITTED] } }),
      Match.countDocuments({ status: { $in: [MATCH_STATUS.COMPLETED, MATCH_STATUS.SETTLED] } }),
      Match.countDocuments({ status: MATCH_STATUS.DISPUTED }),
      Withdrawal.countDocuments({ status: "pending" }),
      Kyc.countDocuments({ status: "verified" }),
      PaymentOrder.aggregate([
        { $match: { status: PAYMENT_ORDER_STATUS.SUCCESS, createdAt: { $gte: startOfDay } } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      PaymentOrder.aggregate([
        { $match: { status: PAYMENT_ORDER_STATUS.SUCCESS } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Withdrawal.aggregate([
        { $match: { status: "approved", createdAt: { $gte: startOfDay } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Withdrawal.aggregate([
        { $match: { status: "approved" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Match.aggregate([
        { $match: { status: { $in: [MATCH_STATUS.COMPLETED, MATCH_STATUS.SETTLED] } } },
        { $group: { _id: null, totalPlatformFee: { $sum: { $subtract: [{ $multiply: ["$entryCoins", 2] }, "$prizeCoins"] } } } },
      ]),
      Transaction.aggregate([
        { $match: { type: { $in: [TRANSACTION_TYPE.REFERRAL_BONUS, TRANSACTION_TYPE.MATCH_REFERRAL_COMMISSION] } } },
        { $group: { _id: null, totalPayout: { $sum: "$amount" } } },
      ]),
      PaymentOrder.aggregate([
        { $match: { status: PAYMENT_ORDER_STATUS.SUCCESS, createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            amount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Withdrawal.aggregate([
        { $match: { status: "approved", createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            amount: { $sum: "$amount" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Match.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Match.aggregate([
        { $match: { status: { $in: [MATCH_STATUS.COMPLETED, MATCH_STATUS.SETTLED] }, createdAt: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            grossRevenue: { $sum: { $subtract: [{ $multiply: ["$entryCoins", 2] }, "$prizeCoins"] } },
          },
        },
        { $sort: { _id: 1 } }
      ]),
      Transaction.aggregate([
        { $match: { type: { $in: [TRANSACTION_TYPE.REFERRAL_BONUS, TRANSACTION_TYPE.MATCH_REFERRAL_COMMISSION] }, createdAt: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            payout: { $sum: "$amount" },
          },
        },
        { $sort: { _id: 1 } }
      ]),
      Wallet.aggregate([
        { $match: { _id: { $exists: true } } },
        { $group: { _id: null, totalDeposit: { $sum: "$depositCoins" }, totalWinning: { $sum: "$winningCoins" } } }
      ]),
    ]);

    // Build complete 7-day series array
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });

      const dep = dailyDepositsAgg.find((x) => x._id === dateStr);
      const wd = dailyWithdrawalsAgg.find((x) => x._id === dateStr);
      const m = dailyMatchesAgg.find((x) => x._id === dateStr);

      chartData.push({
        date: dateStr,
        day: dayLabel,
        deposits: dep ? dep.amount : 0,
        withdrawals: wd ? wd.amount : 0,
        matches: m ? m.count : 0,
      });
    }

    // Build 6-month series array
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toISOString().split("T")[0].substring(0, 7); // YYYY-MM
      const monthLabel = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

      const mRev = monthlyMatchesAgg.find(x => x._id === monthStr);
      const mPay = monthlyReferralsAgg.find(x => x._id === monthStr);

      const gross = mRev ? mRev.grossRevenue : 0;
      const payout = mPay ? mPay.payout : 0;

      monthlyData.push({
        monthStr,
        label: monthLabel,
        grossRevenue: gross,
        referralPayout: payout,
        netRevenue: gross - payout
      });
    }

    const totalAppRevenue = (appRevenueAgg[0]?.totalPlatformFee || 0) - (referralPayoutsAgg[0]?.totalPayout || 0);
    const notVerifiedKyc = Math.max(0, totalUsers - verifiedKyc);

    res.json({
      totalUsers,
      activeUsers,
      frozenWallets,
      activeMatches,
      completedMatches,
      disputedMatches,
      pendingWithdrawals,
      verifiedKyc,
      notVerifiedKyc,
      todayDeposits: todayDepositsAgg[0]?.total || 0,
      todayDepositCount: todayDepositsAgg[0]?.count || 0,
      totalDeposits: totalDepositsAgg[0]?.total || 0,
      todayWithdrawals: todayWithdrawalsAgg[0]?.total || 0,
      totalWithdrawals: totalWithdrawalsAgg[0]?.total || 0,
      totalAppRevenue: totalAppRevenue,
      chartData,
      monthlyData,
      totalDepositWallet: walletSumsAgg[0]?.totalDeposit || 0,
      totalWinningWallet: walletSumsAgg[0]?.totalWinning || 0
    });
  })
);

// GET /api/admin/users
router.get(
  "/users",
  requireUserAdmin,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 300, 1), 1000);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;
    const search = String(req.query.search || "").trim();

    const matchStage = {};
    if (search) {
      matchStage.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search } },
      ];
    }

    const users = await User.aggregate([
      ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "wallets",
          localField: "_id",
          foreignField: "user",
          as: "wallet"
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "referredBy",
          as: "referrals"
        }
      },
      {
        $lookup: {
          from: "transactions",
          let: { userId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$user", "$$userId"] },
                type: { $in: ["REFERRAL_BONUS", "MATCH_REFERRAL_COMMISSION"] }
              }
            },
            {
              $group: {
                _id: null,
                totalEarnings: { $sum: "$amount" }
              }
            }
          ],
          as: "referralEarnings"
        }
      },
      {
        $addFields: {
          wallet: { $arrayElemAt: ["$wallet", 0] },
          referralsCount: { $size: "$referrals" },
          referralEarnings: {
            $ifNull: [{ $arrayElemAt: ["$referralEarnings.totalEarnings", 0] }, 0]
          }
        }
      },
      {
        $addFields: {
          "wallet.totalCoins": {
            $add: [
              { $ifNull: ["$wallet.depositCoins", 0] },
              { $ifNull: ["$wallet.winningCoins", 0] },
              { $ifNull: ["$wallet.bonusCoins", 0] }
            ]
          }
        }
      },
      {
        $project: {
          passwordHash: 0,
          referrals: 0
        }
      }
    ]);
    res.json(users);
  })
);

// GET /api/admin/users/:id — Detailed user profile breakdown
router.get(
  "/users/:id",
  requireUserAdmin,
  asyncHandler(async (req, res) => {
    const userId = req.params.id;
    const user = await User.findById(userId).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const [wallet, transactions, matches, kyc, referrals] = await Promise.all([
      getOrCreateWallet(userId),
      Transaction.find({ user: userId }).sort({ createdAt: -1 }).limit(100),
      Match.find({ $or: [{ creator: userId }, { opponent: userId }] })
        .populate("creator", "name phone")
        .populate("opponent", "name phone")
        .populate("winner", "name")
        .sort({ createdAt: -1 })
        .limit(50),
      Kyc.findOne({ user: userId }),
      User.find({ referredBy: userId }).select("name phone createdAt status").sort({ createdAt: -1 }),
    ]);

    res.json({
      user,
      wallet,
      transactions,
      matches,
      kyc,
      referrals,
    });
  })
);

// PATCH /api/admin/users/:id/password — Admin resets password for a user
router.patch(
  "/users/:id/password",
  requireOwner,
  requireFields("newPassword"),
  asyncHandler(async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    if (!canTargetUser(req.user.role, targetUser.role)) {
      return res.status(403).json({ message: "You do not have permission to modify this user account." });
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    targetUser.passwordHash = passwordHash;
    await targetUser.save();

    await logAdminAction(req, "RESET_PASSWORD", "Reset user password", targetUser._id);
    const safeUser = targetUser.toObject();
    delete safeUser.passwordHash;
    res.json({ message: "Password reset successfully", user: safeUser });
  })
);

// PATCH /api/admin/users/:id/role — Change user role
router.patch(
  "/users/:id/role",
  requireOwner,
  requireFields("role"),
  asyncHandler(async (req, res) => {
    const { role } = req.body;
    const validRoles = ["user", "admin", "finance_admin", "owner", "master"];
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role value" });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    if (!canTargetUser(req.user.role, targetUser.role)) {
      return res.status(403).json({ message: "You do not have permission to modify this user account." });
    }

    if (req.user.role !== "master" && (role === "master" || (role === "owner" && req.user.role !== "master"))) {
      return res.status(403).json({ message: "You do not have permission to assign this role." });
    }

    targetUser.role = role;
    await targetUser.save();
    
    await logAdminAction(req, "CHANGE_ROLE", `Changed role to ${role}`, targetUser._id);
    res.json(targetUser.toObject({ transform: (doc, ret) => { delete ret.passwordHash; return ret; } }));
  })
);

// POST /api/admin/users — admin creates a member account directly, no OTP
// step (admin already vouches for the identity). Mirrors public register's
// wallet seeding so the new account behaves like any other from day one.
router.post(
  "/users",
  requireUserAdmin,
  requireFields("name", "phone", "password"),
  asyncHandler(async (req, res) => {
    const name = String(req.body.name).trim();
    const phone = String(req.body.phone).replace(/\D/g, "").slice(-10);
    const password = String(req.body.password);
    const validRoles = ["user", "admin", "finance_admin", "owner", "master"];
    let role = validRoles.includes(req.body.role) ? req.body.role : "user";

    if (req.user.role !== "master" && (role === "master" || (role === "owner" && req.user.role !== "owner"))) {
      role = "user"; // Prevent non-owners from creating owner
    }

    if (!name) {
      return res.status(400).json({ message: "Please enter a name." });
    }
    if (!PHONE_REGEX.test(phone)) {
      return res.status(400).json({ message: "Please enter a valid 10-digit mobile number." });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(409).json({ message: "An account with this phone number already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      phone,
      passwordHash,
      role,
      status: "active",
      referralCode: generateReferralCode(),
    });

    // Welcome bonus is currently disabled (STARTING_COINS = 0) — creditCoins
    // rejects a zero amount, so skip the call entirely rather than crediting
    // nothing.
    if (STARTING_COINS > 0) {
      await creditCoins(user._id, STARTING_COINS, {
        type: TRANSACTION_TYPE.WELCOME_BONUS,
        note: "Welcome bonus (added by admin)",
      });
    }

    const safeUser = user.toObject();
    delete safeUser.passwordHash;
    
    await logAdminAction(req, "CREATE_USER", `Created member ${phone} with role ${role}`, user._id);
    res.status(201).json(safeUser);
  })
);

// PATCH /api/admin/users/:id/status  { status: "active" | "disabled" }
router.patch(
  "/users/:id/status",
  requireUserAdmin,
  requireFields("status"),
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!["active", "disabled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!canTargetUser(req.user.role, targetUser.role)) {
      return res.status(403).json({ message: "You do not have permission to modify this user account." });
    }

    if (status === "disabled" && (["owner", "master"].includes(targetUser.role) || targetUser.phone === "9828786246")) {
      return res.status(403).json({ message: "Owner accounts are protected and cannot be disabled." });
    }

    targetUser.status = status;
    await targetUser.save();

    const safeUser = targetUser.toObject();
    delete safeUser.passwordHash;

    await logAdminAction(req, "CHANGE_STATUS", `Changed status to ${status}`, targetUser._id);
    res.json(safeUser);
  })
);

// PATCH /api/admin/users/:id/wallet/freeze  { walletFrozen: boolean }
router.patch(
  "/users/:id/wallet/freeze",
  requireUserAdmin,
  requireFields("walletFrozen"),
  asyncHandler(async (req, res) => {
    const { walletFrozen } = req.body;
    if (typeof walletFrozen !== "boolean") {
      return res.status(400).json({ message: "walletFrozen must be a boolean" });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!canTargetUser(req.user.role, targetUser.role)) {
      return res.status(403).json({ message: "You do not have permission to modify this user account." });
    }

    targetUser.walletFrozen = walletFrozen;
    await targetUser.save();

    const safeUser = targetUser.toObject();
    delete safeUser.passwordHash;

    await logAdminAction(req, "TOGGLE_FREEZE", `Changed wallet freeze to ${walletFrozen}`, targetUser._id);
    res.json(safeUser);
  })
);

// POST /api/admin/users/:id/wallet/adjust { amount: number, bucket: "DEPOSIT" | "WINNING" | "BONUS", adjustmentType?: string, note: string }
router.post(
  "/users/:id/wallet/adjust",
  requireFinance,
  requireFields("amount", "bucket", "note"),
  asyncHandler(async (req, res) => {
    const amount = Number(req.body.amount);
    const bucket = String(req.body.bucket).toUpperCase();
    const adjustmentType = String(req.body.adjustmentType || "").toUpperCase();
    const note = String(req.body.note).trim();

    if (!Number.isInteger(amount) || amount === 0) {
      return res.status(400).json({ message: "Amount must be a non-zero integer" });
    }
    if (!["DEPOSIT", "WINNING", "BONUS"].includes(bucket)) {
      return res.status(400).json({ message: "Bucket must be DEPOSIT, WINNING, or BONUS" });
    }
    if (!note) {
      return res.status(400).json({ message: "Note is required for auditing" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!canTargetUser(req.user.role, user.role)) {
      return res.status(403).json({ message: "You do not have permission to adjust wallet for this user account." });
    }

    // Determine exact transaction type
    let txType = TRANSACTION_TYPE.ADMIN_ADJUSTMENT;
    const validTypes = [
      TRANSACTION_TYPE.ADMIN_BONUS,
      TRANSACTION_TYPE.ADMIN_PENALTY,
      TRANSACTION_TYPE.ADMIN_ADJUSTMENT,
      TRANSACTION_TYPE.PROMO_BONUS,
      TRANSACTION_TYPE.WELCOME_BONUS,
      TRANSACTION_TYPE.BATTLE_ERROR_REFUND,
      TRANSACTION_TYPE.SYSTEM_ERROR_COMPENSATION,
      TRANSACTION_TYPE.MANUAL_DEPOSIT,
      TRANSACTION_TYPE.TOURNAMENT_PRIZE,
    ];

    if (adjustmentType && validTypes.includes(adjustmentType)) {
      txType = adjustmentType;
    } else {
      if (amount > 0 && bucket === "BONUS") txType = TRANSACTION_TYPE.ADMIN_BONUS;
      else if (amount < 0) txType = TRANSACTION_TYPE.ADMIN_PENALTY;
    }

    const wallet = await getOrCreateWallet(user._id);
    const bucketField = bucket === "DEPOSIT" ? "depositCoins" : bucket === "WINNING" ? "winningCoins" : "bonusCoins";
    
    if (amount < 0 && wallet[bucketField] < Math.abs(amount)) {
      return res.status(400).json({ message: `Insufficient coins in ${bucket} bucket to deduct ${Math.abs(amount)}` });
    }

    wallet[bucketField] += amount;
    wallet.totalCoins = wallet.depositCoins + wallet.winningCoins + wallet.bonusCoins;
    await wallet.save();

    const transaction = await Transaction.create({
      user: user._id,
      type: txType,
      bucket: bucket === "DEPOSIT" ? WALLET_BUCKET.DEPOSIT : bucket === "WINNING" ? WALLET_BUCKET.WINNING : WALLET_BUCKET.BONUS,
      amount: amount,
      balanceAfter: wallet.totalCoins,
      note: note,
    });

    // Notify user in-app
    await notifyUser(user._id, {
      type: NOTIFICATION_TYPE.ANNOUNCEMENT,
      title: amount > 0 ? "🎁 Wallet Credit Added" : "⚠️ Wallet Deduction Notice",
      message: `${amount > 0 ? `+${amount}` : amount} coins adjusted in your ${bucket.toLowerCase()} wallet (${note}).`,
    });

    await logAdminAction(req, "ADJUST_WALLET", `Adjusted ${bucket} (${txType}) by ${amount} coins. Note: ${note}`, user._id);
    res.json(transaction);
  })
);

// GET /api/admin/matches
router.get(
  "/matches",
  requireUserAdmin,
  asyncHandler(async (req, res) => {
    const matches = await Match.find()
      .select("-resultProof.imageUrl")
      .populate("creator", "name phone")
      .populate("opponent", "name phone")
      .populate("winner", "name")
      .populate("resultProof.user", "name")
      .sort({ createdAt: -1 });
    res.json(matches);
  })
);

// GET /api/admin/matches/:id/proof
router.get(
  "/matches/:id/proof",
  requireUserAdmin,
  asyncHandler(async (req, res) => {
    const match = await Match.findById(req.params.id).select("resultProof");
    if (!match) return res.status(404).json({ message: "Match not found" });
    res.json(match.resultProof);
  })
);

// GET /api/admin/withdrawals
router.get(
  "/withdrawals",
  requireFinance,
  asyncHandler(async (req, res) => {
    const withdrawals = await Withdrawal.find().populate("user", "name phone").sort({ createdAt: -1 });
    res.json(withdrawals);
  })
);

// PATCH /api/admin/matches/:id/resolve
router.patch(
  "/matches/:id/resolve",
  requireUserAdmin,
  requireFields("action"),
  asyncHandler(async (req, res) => {
    const { action } = req.body;
    if (!["declare_creator_win", "declare_opponent_win", "cancel_and_refund"].includes(action)) {
      return res.status(400).json({ message: "Invalid action" });
    }

    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: "Match not found" });

    const validStatuses = [
      MATCH_STATUS.JOINED,
      MATCH_STATUS.ACCEPTED,
      MATCH_STATUS.ROOM_SHARED,
      MATCH_STATUS.PLAYING,
      MATCH_STATUS.RESULT_SUBMITTED,
      MATCH_STATUS.DISPUTED
    ];
    if (!validStatuses.includes(match.status)) {
      return res.status(400).json({ message: "Only active or disputed matches can be resolved this way" });
    }

    if (action === "cancel_and_refund") {
      const updatedMatch = await Match.findOneAndUpdate(
        { _id: req.params.id, status: { $in: validStatuses } },
        { $set: { status: MATCH_STATUS.REFUNDED, cancelReason: "Disputed match cancelled & refunded by admin" } },
        { new: true }
      );
      if (!updatedMatch) {
        return res.status(409).json({ message: "Match was already resolved, cancelled, or cannot be resolved." });
      }
      
      await creditCoins(updatedMatch.creator, updatedMatch.entryCoins, {
        type: TRANSACTION_TYPE.BATTLE_REFUND,
        match: updatedMatch._id,
        note: "Refund: match disputed and cancelled by admin",
        reference: `admin_battle_refund_creator:${updatedMatch._id}`,
      });
      if (updatedMatch.opponent) {
        await creditCoins(updatedMatch.opponent, updatedMatch.entryCoins, {
          type: TRANSACTION_TYPE.BATTLE_REFUND,
          match: updatedMatch._id,
          note: "Refund: match disputed and cancelled by admin",
          reference: `admin_battle_refund_opponent:${updatedMatch._id}`,
        });
      }
      await logAdminAction(req, "RESOLVE_MATCH", `Cancelled and refunded match ${updatedMatch._id}`, null);
      return res.json(updatedMatch);
    }

    // Resolve as Win for one of them
    const winnerId = action === "declare_creator_win" ? match.creator : match.opponent;
    const loserId = action === "declare_creator_win" ? match.opponent : match.creator;

    const updatedMatch = await Match.findOneAndUpdate(
      { _id: req.params.id, status: { $in: validStatuses } },
      {
        $set: {
          winner: winnerId,
          loser: loserId,
          status: MATCH_STATUS.SETTLED,
          creatorResult: action === "declare_creator_win" ? "WIN" : "LOSS",
          opponentResult: action === "declare_creator_win" ? "LOSS" : "WIN",
        },
      },
      { new: true }
    );
    if (!updatedMatch) {
      return res.status(409).json({ message: "Match was already resolved, cancelled, or cannot be resolved." });
    }

    // Payout
    const pool = updatedMatch.entryCoins * 2;
    const commissionAmount = pool - updatedMatch.prizeCoins;
    const winnerWallet = await getOrCreateWallet(updatedMatch.winner);
    
    await Transaction.create({
      user: updatedMatch.winner,
      type: TRANSACTION_TYPE.ADMIN_ADJUSTMENT,
      bucket: WALLET_BUCKET.MIXED,
      amount: 0,
      balanceAfter: winnerWallet.totalCoins,
      note: `Platform commission (${PLATFORM_FEE_PERCENT}%): ${commissionAmount} coins deducted from the ${pool}-coin pool before this prize payout`,
      match: updatedMatch._id,
      reference: `admin_commission_note:${updatedMatch._id}`,
    }).catch(() => {});

    await creditCoins(updatedMatch.winner, updatedMatch.prizeCoins, {
      type: TRANSACTION_TYPE.BATTLE_PRIZE,
      match: updatedMatch._id,
      note: "Battle prize payout (Admin Resolved)",
      reference: `admin_battle_prize:${updatedMatch._id}`,
    });

    // Payout referral commission based on the winning amount (prizeCoins)
    await processReferralCommission(updatedMatch.winner, updatedMatch, updatedMatch.prizeCoins);

    await notifyUser(updatedMatch.winner, {
      type: NOTIFICATION_TYPE.MATCH_WON,
      title: "Dispute Resolved: You won!",
      message: `Admin resolved the dispute in your favor. You won ${updatedMatch.prizeCoins} coins.`,
      match: updatedMatch._id,
    });
    await logAdminAction(req, "RESOLVE_MATCH", `Resolved match ${updatedMatch._id} as ${action}`, updatedMatch.winner);
    return res.json(updatedMatch);
  })
);

// PATCH /api/admin/withdrawals/:id  { action: "approve" | "reject", note? }
router.patch(
  "/withdrawals/:id",
  requireFinance,
  requireFields("action"),
  asyncHandler(async (req, res) => {
    const { action, note } = req.body;
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "Invalid action" });
    }

    // Atomic, condition-guarded update: only succeeds if still pending, so
    // two concurrent approve/reject calls on the same request can't both
    // go through (no double-refund, no double-payout).
    const withdrawal = await Withdrawal.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      {
        $set: {
          status: action === "approve" ? "approved" : "rejected",
          processedBy: req.user.id,
          processedAt: new Date(),
          ...(note ? { note } : {}),
        },
      },
      { new: true }
    );

    if (!withdrawal) {
      const exists = await Withdrawal.exists({ _id: req.params.id });
      return res
        .status(exists ? 400 : 404)
        .json({ message: exists ? "Withdrawal request already processed" : "Withdrawal request not found" });
    }

    // The amount was already deducted from winningCoins when the user
    // submitted the request — a rejection gives it back. Approval means
    // it was actually paid out, so no wallet change is needed there.
    if (action === "reject") {
      await creditCoins(withdrawal.user, withdrawal.amount, {
        type: TRANSACTION_TYPE.WITHDRAWAL_REFUND,
        note: "Withdrawal request rejected — amount refunded",
        reference: `withdrawal_refund:${withdrawal._id}`,
      });
    }

    await notifyUser(withdrawal.user, {
      type: action === "approve" ? NOTIFICATION_TYPE.WITHDRAWAL_APPROVED : NOTIFICATION_TYPE.WITHDRAWAL_REJECTED,
      title: action === "approve" ? "Withdrawal approved" : "Withdrawal rejected",
      message:
        action === "approve"
          ? `Your withdrawal of ${withdrawal.amount} coins has been approved and paid out.`
          : `Your withdrawal of ${withdrawal.amount} coins was rejected and refunded to your Winning Coins.`,
    });

    await withdrawal.populate("user", "name phone");
    await logAdminAction(req, "REVIEW_WITHDRAWAL", `Reviewed withdrawal as ${action}`, withdrawal.user._id);

    res.json(withdrawal);
  })
);

// GET /api/admin/deposit-history — read-only ledger of automatic IMB
// payment orders. No approve/reject here: crediting happens only via
// markPaymentOrderSuccessAndCredit (utils/paymentLedger.js) once real IMB
// payment verification is wired in — there is nothing for an admin to
// manually decide on a per-order basis.
router.get(
  "/deposit-history",
  requireFinance,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
    const orders = await PaymentOrder.find()
      .populate("user", "name phone")
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json(orders);
  })
);

// POST /api/admin/deposit-history/:id/refresh
router.post(
  "/deposit-history/:id/refresh",
  requireFinance,
  asyncHandler(async (req, res) => {
    const order = await PaymentOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status === PAYMENT_ORDER_STATUS.SUCCESS) {
      return res.status(400).json({ message: "Order is already credited." });
    }

    const imbResponse = await checkImbOrderStatus(order.orderId);
    const isSuccess = isImbStatusSuccess(imbResponse);
    const isFailed = isImbStatusFailed(imbResponse);

    if (isSuccess) {
      order.imbResponse = imbResponse;
      await order.save();
      const credited = await markPaymentOrderSuccessAndCredit(order.orderId, { note: "Payment top-up (Admin Refresh)" });
      if (credited) {
        return res.json({ message: "Payment successful! Wallet credited.", order: credited });
      } else {
        const currentOrder = await PaymentOrder.findById(order._id);
        return res.json({ message: "Order already processed.", order: currentOrder || order });
      }
    } else {
      order.imbResponse = imbResponse;
      if (isFailed) {
        order.status = PAYMENT_ORDER_STATUS.FAILED;
      }
      await order.save();
      return res.json({ message: `Payment status from gateway: ${order.status}.`, order });
    }
  })
);

// GET /api/admin/deposit-methods — all destinations, including inactive ones.
router.get(
  "/deposit-methods",
  requireFinance,
  asyncHandler(async (req, res) => {
    const methods = await DepositMethod.find().sort({ order: 1, createdAt: -1 });
    res.json(methods);
  })
);

// POST /api/admin/deposit-methods
router.post(
  "/deposit-methods",
  requireOwner,
  requireFields("label", "method"),
  asyncHandler(async (req, res) => {
    const label = String(req.body.label).trim();
    const { method } = req.body;
    if (!label) {
      return res.status(400).json({ message: "Label is required" });
    }
    if (!["upi", "bank"].includes(method)) {
      return res.status(400).json({ message: "method must be 'upi' or 'bank'" });
    }

    const upiId = String(req.body.upiId || "").trim();
    const accountHolderName = String(req.body.accountHolderName || "").trim();
    const accountNumber = String(req.body.accountNumber || "").trim();
    const ifsc = String(req.body.ifsc || "").trim();
    if (method === "upi" && !upiId) {
      return res.status(400).json({ message: "UPI ID is required" });
    }
    if (method === "bank" && (!accountHolderName || !accountNumber || !ifsc)) {
      return res
        .status(400)
        .json({ message: "Account holder name, account number and IFSC are required" });
    }

    const order = Number.isFinite(Number(req.body.order)) ? Number(req.body.order) : 0;

    const depositMethod = await DepositMethod.create({
      label,
      method,
      upiId,
      accountHolderName,
      accountNumber,
      ifsc,
      order,
      isActive: true,
    });

    res.status(201).json(depositMethod);
  })
);

// PATCH /api/admin/deposit-methods/:id
router.patch(
  "/deposit-methods/:id",
  requireOwner,
  asyncHandler(async (req, res) => {
    const allowed = [
      "label",
      "method",
      "upiId",
      "accountHolderName",
      "accountNumber",
      "ifsc",
      "isActive",
      "order",
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const depositMethod = await DepositMethod.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!depositMethod) {
      return res.status(404).json({ message: "Deposit method not found" });
    }
    res.json(depositMethod);
  })
);

// DELETE /api/admin/deposit-methods/:id
router.delete(
  "/deposit-methods/:id",
  requireOwner,
  asyncHandler(async (req, res) => {
    const depositMethod = await DepositMethod.findByIdAndDelete(req.params.id);
    if (!depositMethod) {
      return res.status(404).json({ message: "Deposit method not found" });
    }
    res.json({ message: "Deposit method deleted" });
  })
);

// POST /api/admin/notifications/broadcast — sends an announcement to every
// active user's notification inbox.
router.post(
  "/notifications/broadcast",
  requireUserAdmin,
  requireFields("title"),
  asyncHandler(async (req, res) => {
    const title = String(req.body.title).trim();
    const message = String(req.body.message || "").trim();
    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    const sentCount = await notifyAllUsers({ type: NOTIFICATION_TYPE.ANNOUNCEMENT, title, message });
    await logAdminAction(req, "BROADCAST_ANNOUNCEMENT", `Broadcast sent: ${title}`, null);
    res.status(201).json({ message: "Announcement sent", sentCount });
  })
);

// GET /api/admin/notifications/broadcasts — fetch recent unique announcements
router.get(
  "/notifications/broadcasts",
  requireUserAdmin,
  asyncHandler(async (req, res) => {
    const broadcasts = await Notification.aggregate([
      { $match: { type: NOTIFICATION_TYPE.ANNOUNCEMENT } },
      { $group: { 
          _id: { title: "$title", message: "$message" }, 
          count: { $sum: 1 }, 
          createdAt: { $max: "$createdAt" } 
      }},
      { $sort: { createdAt: -1 } },
      { $limit: 20 }
    ]);
    res.json(broadcasts.map(b => ({
      title: b._id.title,
      message: b._id.message,
      count: b.count,
      createdAt: b.createdAt
    })));
  })
);

// DELETE /api/admin/notifications/broadcasts — delete an announcement by title
router.delete(
  "/notifications/broadcasts",
  requireUserAdmin,
  asyncHandler(async (req, res) => {
    const { title } = req.query;
    if (!title) return res.status(400).json({ message: "Title query param is required" });
    
    const result = await Notification.deleteMany({ 
      type: NOTIFICATION_TYPE.ANNOUNCEMENT, 
      title: String(title) 
    });
    
    await logAdminAction(req, "DELETE_ANNOUNCEMENT", `Deleted announcement: ${title}`, null);
    res.json({ message: "Announcement deleted", deletedCount: result.deletedCount });
  })
);

// GET /api/admin/support-tickets
router.get(
  "/support-tickets",
  requireUserAdmin,
  asyncHandler(async (req, res) => {
    const tickets = await SupportTicket.find().populate("user", "name phone").sort({ createdAt: -1 });
    res.json(tickets);
  })
);

// GET /api/admin/support-tickets/:id
router.get(
  "/support-tickets/:id",
  requireUserAdmin,
  asyncHandler(async (req, res) => {
    const ticket = await SupportTicket.findById(req.params.id).populate("user", "name phone");
    if (!ticket) {
      return res.status(404).json({ message: "Support ticket not found" });
    }
    res.json(ticket);
  })
);

// PATCH /api/admin/support-tickets/:id  { status: "open" | "pending" | "closed" }
router.patch(
  "/support-tickets/:id",
  requireUserAdmin,
  requireFields("status"),
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!["open", "pending", "closed"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, { status }, { new: true }).populate(
      "user",
      "name phone"
    );
    if (!ticket) {
      return res.status(404).json({ message: "Support ticket not found" });
    }
    res.json(ticket);
  })
);

// GET /api/admin/banners — all banners, including inactive ones.
router.get(
  "/banners",
  requireOwner,
  asyncHandler(async (req, res) => {
    const banners = await Banner.find().sort({ order: 1, createdAt: -1 });
    res.json(banners);
  })
);

// POST /api/admin/banners
router.post(
  "/banners",
  requireOwner,
  requireFields("title", "imageUrl"),
  asyncHandler(async (req, res) => {
    const title = String(req.body.title).trim();
    const imageUrl = String(req.body.imageUrl).trim();
    const linkUrl = req.body.linkUrl ? String(req.body.linkUrl).trim() : "";
    const order = Number.isFinite(Number(req.body.order)) ? Number(req.body.order) : 0;

    if (!title || !imageUrl) {
      return res.status(400).json({ message: "Title and image URL are required." });
    }

    const banner = await Banner.create({ title, imageUrl, linkUrl, order, isActive: true });
    res.status(201).json(banner);
  })
);

// PATCH /api/admin/banners/:id — update any of title/imageUrl/linkUrl/order/isActive.
router.patch(
  "/banners/:id",
  requireOwner,
  asyncHandler(async (req, res) => {
    const allowed = ["title", "imageUrl", "linkUrl", "order", "isActive"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const banner = await Banner.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!banner) {
      return res.status(404).json({ message: "Banner not found" });
    }
    res.json(banner);
  })
);

// DELETE /api/admin/banners/:id
router.delete(
  "/banners/:id",
  requireOwner,
  asyncHandler(async (req, res) => {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) {
      return res.status(404).json({ message: "Banner not found" });
    }
    res.json({ message: "Banner deleted" });
  })
);

// GET /api/admin/notices — all notices including inactive
router.get(
  "/notices",
  requireOwner,
  asyncHandler(async (req, res) => {
    const notices = await Notice.find().sort({ order: 1, createdAt: -1 });
    res.json(notices);
  })
);

// POST /api/admin/notices — create new notice bulletin
router.post(
  "/notices",
  requireOwner,
  requireFields("text"),
  asyncHandler(async (req, res) => {
    const text = String(req.body.text).trim();
    const dateTag = req.body.dateTag ? String(req.body.dateTag).trim() : new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const order = Number.isFinite(Number(req.body.order)) ? Number(req.body.order) : 0;

    if (!text) {
      return res.status(400).json({ message: "Notice text is required." });
    }

    const notice = await Notice.create({ text, dateTag, order, isActive: true });
    res.status(201).json(notice);
  })
);

// PATCH /api/admin/notices/:id
router.patch(
  "/notices/:id",
  requireOwner,
  asyncHandler(async (req, res) => {
    const allowed = ["text", "dateTag", "order", "isActive"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const notice = await Notice.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!notice) {
      return res.status(404).json({ message: "Notice not found" });
    }
    res.json(notice);
  })
);

// DELETE /api/admin/notices/:id
router.delete(
  "/notices/:id",
  requireOwner,
  asyncHandler(async (req, res) => {
    const notice = await Notice.findByIdAndDelete(req.params.id);
    if (!notice) {
      return res.status(404).json({ message: "Notice not found" });
    }
    res.json({ message: "Notice deleted" });
  })
);

// GET /api/admin/referral-settings
router.get(
  "/referral-settings",
  requireOwner,
  asyncHandler(async (req, res) => {
    res.json(await getReferralSettings());
  })
);

// PATCH /api/admin/referral-settings
router.patch(
  "/referral-settings",
  requireOwner,
  asyncHandler(async (req, res) => {
    const settings = await getReferralSettings();

    if (req.body.commissionEnabled !== undefined) {
      settings.commissionEnabled = Boolean(req.body.commissionEnabled);
    }

    if (req.body.commissionPercentage !== undefined) {
      const commissionPercentage = Number(req.body.commissionPercentage);
      if (!Number.isFinite(commissionPercentage) || commissionPercentage < 0 || commissionPercentage > 100) {
        return res.status(400).json({ message: "Commission percentage must be between 0 and 100" });
      }
      settings.commissionPercentage = commissionPercentage;
    }

    if (req.body.maxCommissionAmount !== undefined) {
      const maxCommissionAmount = Number(req.body.maxCommissionAmount);
      if (!Number.isFinite(maxCommissionAmount) || maxCommissionAmount < 0) {
        return res.status(400).json({ message: "Max commission amount must be a non-negative number" });
      }
      settings.maxCommissionAmount = maxCommissionAmount;
    }

    await settings.save();
    res.json(settings);
  })
);

// GET /api/admin/ludoroom-profile
router.get(
  "/ludoroom-profile",
  requireOwner,
  asyncHandler(async (req, res) => {
    const settings = await getSiteSettings();
    const apiKey = req.query.key || settings.ludoRoomApiKey;
    if (!apiKey) {
      return res.status(400).json({ message: "LudoRoom API Key not configured" });
    }
    
    // Dynamic import of fetch to avoid issues if not globally available in this file yet
    const { default: fetch } = await import("node-fetch");
    
    const response = await fetch("https://ludoroom.in/api/profile", {
      headers: { "x-api-key": apiKey }
    });
    
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ message: data.message || "Failed to fetch LudoRoom profile" });
    }
    
    res.json(data);
  })
);

// GET /api/admin/site-settings
router.get(
  "/site-settings",
  requireOwner,
  asyncHandler(async (req, res) => {
    res.json(await getSiteSettings());
  })
);

// PATCH /api/admin/site-settings
router.patch(
  "/site-settings",
  requireOwner,
  asyncHandler(async (req, res) => {
    const settings = await getSiteSettings();
    
    if (req.body.homeNoticeText !== undefined) {
      settings.homeNoticeText = String(req.body.homeNoticeText).trim();
    }
    
    if (req.body.minDeposit !== undefined) {
      const minDeposit = Number(req.body.minDeposit);
      if (Number.isFinite(minDeposit) && minDeposit >= 0) settings.minDeposit = minDeposit;
    }
    
    if (req.body.maxDeposit !== undefined) {
      const maxDeposit = Number(req.body.maxDeposit);
      if (Number.isFinite(maxDeposit) && maxDeposit >= 0) settings.maxDeposit = maxDeposit;
    }

    if (req.body.minWithdrawal !== undefined) {
      const minWithdrawal = Number(req.body.minWithdrawal);
      if (Number.isFinite(minWithdrawal) && minWithdrawal >= 0) settings.minWithdrawal = minWithdrawal;
    }

    if (req.body.maxWithdrawal !== undefined) {
      const maxWithdrawal = Number(req.body.maxWithdrawal);
      if (Number.isFinite(maxWithdrawal) && maxWithdrawal >= 0) settings.maxWithdrawal = maxWithdrawal;
    }

    if (req.body.withdrawalCooldownHours !== undefined) {
      const withdrawalCooldownHours = Number(req.body.withdrawalCooldownHours);
      if (Number.isFinite(withdrawalCooldownHours) && withdrawalCooldownHours >= 0) settings.withdrawalCooldownHours = withdrawalCooldownHours;
    }

    if (req.body.imbApiToken !== undefined) {
      settings.imbApiToken = String(req.body.imbApiToken).trim();
    }

    if (req.body.kycMerchantCode !== undefined) {
      settings.kycMerchantCode = String(req.body.kycMerchantCode).trim();
    }

    if (req.body.kycClientId !== undefined) {
      settings.kycClientId = String(req.body.kycClientId).trim();
    }

    if (req.body.kycClientSecret !== undefined) {
      settings.kycClientSecret = String(req.body.kycClientSecret).trim();
    }

    if (req.body.battleDividerImage !== undefined) {
      settings.battleDividerImage = String(req.body.battleDividerImage).trim();
    }
    if (req.body.myBattlesDividerImage !== undefined) {
      settings.myBattlesDividerImage = String(req.body.myBattlesDividerImage).trim();
    }
    if (req.body.openBattlesDividerImage !== undefined) {
      settings.openBattlesDividerImage = String(req.body.openBattlesDividerImage).trim();
    }
    if (req.body.runningBattlesDividerImage !== undefined) {
      settings.runningBattlesDividerImage = String(req.body.runningBattlesDividerImage).trim();
    }
    if (req.body.leaderboardBannerImage !== undefined) {
      settings.leaderboardBannerImage = String(req.body.leaderboardBannerImage).trim();
    }
    if (req.body.supportWhatsapp !== undefined) {
      settings.supportWhatsapp = String(req.body.supportWhatsapp).trim();
    }
    if (req.body.gameCardImage1 !== undefined) {
      settings.gameCardImage1 = String(req.body.gameCardImage1).trim();
    }
    if (req.body.gameCardImage2 !== undefined) {
      settings.gameCardImage2 = String(req.body.gameCardImage2).trim();
    }
    if (req.body.ludoRoomApiKey !== undefined) {
      settings.ludoRoomApiKey = String(req.body.ludoRoomApiKey).trim();
    }

    if (req.body.withdrawalStartTime !== undefined) {
      settings.withdrawalStartTime = String(req.body.withdrawalStartTime).trim();
    }
    if (req.body.withdrawalEndTime !== undefined) {
      settings.withdrawalEndTime = String(req.body.withdrawalEndTime).trim();
    }

    await settings.save();
    res.json(settings);
  })
);

// GET /api/admin/kyc — all KYC submissions, pending first.
router.get(
  "/kyc",
  requireUserAdmin,
  asyncHandler(async (req, res) => {
    const records = await Kyc.find().populate("user", "name phone").sort({ status: 1, submittedAt: -1 });
    res.json(records);
  })
);

// GET /api/admin/kyc/unsubmitted — fetch all users who have not submitted KYC
router.get(
  "/kyc/unsubmitted",
  requireUserAdmin,
  asyncHandler(async (req, res) => {
    const users = await User.aggregate([
      {
        $lookup: {
          from: "kycs",
          localField: "_id",
          foreignField: "user",
          as: "kycData"
        }
      },
      {
        $match: {
          kycData: { $size: 0 },
          role: "user"
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          phone: 1,
          createdAt: 1
        }
      },
      { $sort: { createdAt: -1 } }
    ]);
    res.json(users);
  })
);

// PATCH /api/admin/kyc/:id  { action: "verify" | "reject", note? }
router.patch(
  "/kyc/:id",
  requireUserAdmin,
  requireFields("action"),
  asyncHandler(async (req, res) => {
    const { action, note } = req.body;
    if (!["verify", "reject"].includes(action)) {
      return res.status(400).json({ message: "Invalid action" });
    }

    // Atomic, condition-guarded update: only succeeds if still pending, so
    // two concurrent verify/reject calls on the same submission can't both
    // go through.
    const kyc = await Kyc.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      {
        $set: {
          status: action === "verify" ? "verified" : "rejected",
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
          ...(note ? { note } : {}),
        },
      },
      { new: true }
    );

    if (!kyc) {
      const exists = await Kyc.exists({ _id: req.params.id });
      return res
        .status(exists ? 400 : 404)
        .json({ message: exists ? "This KYC submission was already reviewed" : "KYC submission not found" });
    }

    await notifyUser(kyc.user, {
      type: action === "verify" ? NOTIFICATION_TYPE.KYC_VERIFIED : NOTIFICATION_TYPE.KYC_REJECTED,
      title: action === "verify" ? "KYC verified" : "KYC rejected",
      message:
        action === "verify"
          ? "Your Aadhaar KYC has been verified. You can now request withdrawals."
          : `Your Aadhaar KYC was rejected${note ? `: ${note}` : ""}. Please resubmit with correct details.`,
    });

    await logAdminAction(req, "REVIEW_KYC", `Reviewed KYC as ${action}`, kyc.user);
    await kyc.populate("user", "name phone");
    res.json(kyc);
  })
);

// POST /api/admin/matches/:id/check-result — Check LudoRoom API for match result
router.post(
  "/matches/:id/check-result",
  requireOwner,
  asyncHandler(async (req, res) => {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: "Match not found" });

    if (!match.roomCode) {
      return res.status(400).json({ message: "Match does not have a room code" });
    }

    const settings = await getSiteSettings();
    if (!settings.ludoRoomApiKey) {
      return res.status(400).json({ message: "LudoRoom API Key is not configured in Site Settings." });
    }

    try {
      const apiRes = await fetch("https://ludoroom.in/api/v1/ludoking/result", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": settings.ludoRoomApiKey
        },
        body: JSON.stringify({ roomCode: match.roomCode, json: true })
      });

      const data = await apiRes.json();
      
      if (!apiRes.ok) {
        return res.status(400).json({ message: data.message || data.msg || "LudoRoom API Error", data });
      }

      // If the API returns the status synchronously
      let updatedMessage = "LudoRoom Result API called successfully.";
      
      if (data.table_status === "Finished" && data.details && data.details.players) {
        // The API returned the result inline! Process it directly.
        let ludoWinnerName = "";
        let ludoLoserName = "";
        data.details.players.forEach(p => {
          if (p.result === "WIN" || p.status === "Won") ludoWinnerName = p.user_id;
          if (p.result === "LOSS" || p.status === "Lost") ludoLoserName = p.user_id;
        });

        match.ludoRoomResult = {
          ludoWinnerName: ludoWinnerName || "Unknown",
          ludoLoserName: ludoLoserName || "Unknown",
          status: "Finished",
          rawPayload: data
        };
        await match.save();
        updatedMessage = `Result fetched: ${ludoWinnerName} Won!`;
      }

      res.json({ message: updatedMessage, data });
    } catch (err) {
      res.status(500).json({ message: "Failed to connect to LudoRoom API: " + err.message });
    }
  })
);

// --- DATABASE STORAGE CLEANUP & DELETION ENDPOINTS ---

// GET /api/admin/storage/stats — detailed category counts
router.get(
  "/storage/stats",
  requireAnyAdmin,
  asyncHandler(async (req, res) => {
    const [
      matchesWithProofCount,
      completedMatchesCount,
      kycWithImageCount,
      processedDepositsCount,
      processedWithdrawalsCount,
      notificationsCount,
      otpLogsCount,
      transactionsCount,
    ] = await Promise.all([
      Match.countDocuments({ "resultProof.0": { $exists: true } }),
      Match.countDocuments({ status: { $in: [MATCH_STATUS.COMPLETED, MATCH_STATUS.CANCELLED, MATCH_STATUS.REFUNDED, MATCH_STATUS.SETTLED] } }),
      Kyc.countDocuments({ aadhaarImageUrl: { $ne: "" }, status: { $in: ["verified", "rejected"] } }),
      PaymentOrder.countDocuments({ status: { $in: [PAYMENT_ORDER_STATUS.SUCCESS, PAYMENT_ORDER_STATUS.FAILED] } }),
      Withdrawal.countDocuments({ status: { $in: ["approved", "rejected"] } }),
      Notification.countDocuments(),
      Otp.countDocuments(),
      Transaction.countDocuments(),
    ]);

    res.json({
      matchesWithProofCount,
      completedMatchesCount,
      kycWithImageCount,
      processedDepositsCount,
      processedWithdrawalsCount,
      notificationsCount,
      otpLogsCount,
      transactionsCount,
    });
  })
);

// POST /api/admin/storage/cleanup — Advanced multi-category & time-range cleanup
router.post(
  "/storage/cleanup",
  requireAnyAdmin,
  requireFields("category"),
  asyncHandler(async (req, res) => {
    const { category } = req.body;
    const timeRangeDays = Number(req.body.timeRangeDays || 0);

    let cutoffDate = null;
    if (timeRangeDays > 0) {
      cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - timeRangeDays);
    }

    const dateFilter = cutoffDate ? { createdAt: { $lt: cutoffDate } } : {};

    let totalCleaned = 0;
    const details = [];

    const cleanMatchScreenshots = async () => {
      const filter = {
        status: { $in: [MATCH_STATUS.COMPLETED, MATCH_STATUS.CANCELLED, MATCH_STATUS.REFUNDED, MATCH_STATUS.SETTLED] },
        "resultProof.0": { $exists: true },
        ...dateFilter,
      };
      const result = await Match.updateMany(filter, { $set: { resultProof: [] } });
      totalCleaned += result.modifiedCount;
      details.push(`${result.modifiedCount} match screenshots cleared`);
    };

    const cleanKycDocuments = async () => {
      const filter = {
        status: { $in: ["verified", "rejected"] },
        aadhaarImageUrl: { $ne: "" },
        ...dateFilter,
      };
      const result = await Kyc.updateMany(filter, { $set: { aadhaarImageUrl: "" } });
      totalCleaned += result.modifiedCount;
      details.push(`${result.modifiedCount} verified KYC documents cleared`);
    };

    const cleanPaymentLogs = async () => {
      const filter = {
        status: { $in: [PAYMENT_ORDER_STATUS.SUCCESS, PAYMENT_ORDER_STATUS.FAILED] },
        ...dateFilter,
      };
      const result = await PaymentOrder.deleteMany(filter);
      totalCleaned += result.deletedCount;
      details.push(`${result.deletedCount} deposit payment logs deleted`);
    };

    const cleanWithdrawalLogs = async () => {
      const filter = {
        status: { $in: ["approved", "rejected"] },
        ...dateFilter,
      };
      const result = await Withdrawal.deleteMany(filter);
      totalCleaned += result.deletedCount;
      details.push(`${result.deletedCount} processed withdrawal records deleted`);
    };

    const cleanNotifications = async () => {
      const result = await Notification.deleteMany(dateFilter);
      totalCleaned += result.deletedCount;
      details.push(`${result.deletedCount} notifications deleted`);
    };

    const cleanOtpLogs = async () => {
      const result = await Otp.deleteMany(dateFilter);
      totalCleaned += result.deletedCount;
      details.push(`${result.deletedCount} OTP records purged`);
    };

    const cleanTransactionLogs = async () => {
      const result = await Transaction.deleteMany(dateFilter);
      totalCleaned += result.deletedCount;
      details.push(`${result.deletedCount} Wallet Transaction Logs purged`);
    };

    if (category === "MATCH_SCREENSHOTS") await cleanMatchScreenshots();
    else if (category === "KYC_DOCUMENTS") await cleanKycDocuments();
    else if (category === "PAYMENT_LOGS") await cleanPaymentLogs();
    else if (category === "WITHDRAWAL_LOGS") await cleanWithdrawalLogs();
    else if (category === "NOTIFICATION_LOGS") await cleanNotifications();
    else if (category === "OTP_LOGS") await cleanOtpLogs();
    else if (category === "TRANSACTION_LOGS") await cleanTransactionLogs();
    else if (category === "ALL") {
      await cleanMatchScreenshots();
      await cleanKycDocuments();
      await cleanPaymentLogs();
      await cleanWithdrawalLogs();
      await cleanNotifications();
      await cleanOtpLogs();
      await cleanTransactionLogs();
    } else {
      return res.status(400).json({ message: "Invalid cleanup category specified." });
    }

    const timeLabel = timeRangeDays > 0 ? `older than ${timeRangeDays} days` : "across all time";
    res.json({
      message: `Storage cleanup successful (${timeLabel}): ${details.join(", ")}`,
      totalCleaned,
      details,
    });
  })
);

// DELETE /api/admin/matches/:id/proof-images — clear result proof images for a single match
router.delete(
  "/matches/:id/proof-images",
  asyncHandler(async (req, res) => {
    const match = await Match.findByIdAndUpdate(
      req.params.id,
      { $set: { resultProof: [] } },
      { new: true }
    );
    if (!match) return res.status(404).json({ message: "Match not found" });
    res.json({ message: "Match proof images cleared", match });
  })
);

// DELETE /api/admin/matches/:id — delete a match record completely (only completed/cancelled/settled)
router.delete(
  "/matches/:id",
  asyncHandler(async (req, res) => {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: "Match not found" });

    if ([MATCH_STATUS.OPEN, MATCH_STATUS.FULL, MATCH_STATUS.RUNNING, MATCH_STATUS.ROOM_SHARED, MATCH_STATUS.PLAYING, MATCH_STATUS.RESULT_SUBMITTED, MATCH_STATUS.DISPUTED].includes(match.status)) {
      return res.status(400).json({ message: "Active or disputed matches cannot be deleted." });
    }

    await Match.findByIdAndDelete(req.params.id);
    res.json({ message: "Match deleted successfully", id: req.params.id });
  })
);

// POST /api/admin/storage/cleanup-match-images — bulk clear result proof images from all finished matches
router.post(
  "/storage/cleanup-match-images",
  asyncHandler(async (req, res) => {
    const result = await Match.updateMany(
      { status: { $in: [MATCH_STATUS.COMPLETED, MATCH_STATUS.CANCELLED, MATCH_STATUS.REFUNDED, MATCH_STATUS.SETTLED] } },
      { $set: { resultProof: [] } }
    );
    res.json({ message: `Cleared proof images from ${result.modifiedCount} finished matches`, count: result.modifiedCount });
  })
);

// DELETE /api/admin/kyc/:id/image — clear base64 document image for a single KYC
router.delete(
  "/kyc/:id/image",
  asyncHandler(async (req, res) => {
    const kyc = await Kyc.findByIdAndUpdate(
      req.params.id,
      { $set: { aadhaarImageUrl: "" } },
      { new: true }
    );
    if (!kyc) return res.status(404).json({ message: "KYC record not found" });
    res.json({ message: "KYC image document cleared", kyc });
  })
);

// POST /api/admin/storage/cleanup-kyc-images — bulk clear base64 document images for verified/rejected KYCs
router.post(
  "/storage/cleanup-kyc-images",
  asyncHandler(async (req, res) => {
    const result = await Kyc.updateMany(
      { status: { $in: ["verified", "rejected"] } },
      { $set: { aadhaarImageUrl: "" } }
    );
    res.json({ message: `Cleared document images from ${result.modifiedCount} verified/rejected KYC records`, count: result.modifiedCount });
  })
);

// DELETE /api/admin/deposit-history/:id — delete a single deposit order record
router.delete(
  "/deposit-history/:id",
  asyncHandler(async (req, res) => {
    const order = await PaymentOrder.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ message: "Deposit order record not found" });
    res.json({ message: "Deposit order deleted successfully", id: req.params.id });
  })
);

// POST /api/admin/storage/cleanup-deposits — bulk delete completed or failed deposit orders
router.post(
  "/storage/cleanup-deposits",
  asyncHandler(async (req, res) => {
    const result = await PaymentOrder.deleteMany({
      status: { $in: [PAYMENT_ORDER_STATUS.SUCCESS, PAYMENT_ORDER_STATUS.FAILED] },
    });
    res.json({ message: `Deleted ${result.deletedCount} completed/failed deposit transaction records`, count: result.deletedCount });
  })
);

// DELETE /api/admin/withdrawals/:id — delete a single processed withdrawal record
router.delete(
  "/withdrawals/:id",
  asyncHandler(async (req, res) => {
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) return res.status(404).json({ message: "Withdrawal record not found" });

    if (withdrawal.status === "pending") {
      return res.status(400).json({ message: "Pending withdrawal requests cannot be deleted before processing." });
    }

    await Withdrawal.findByIdAndDelete(req.params.id);
    res.json({ message: "Withdrawal record deleted successfully", id: req.params.id });
  })
);

// POST /api/admin/storage/cleanup-withdrawals — bulk delete processed (approved/rejected) withdrawals
router.post(
  "/storage/cleanup-withdrawals",
  asyncHandler(async (req, res) => {
    const result = await Withdrawal.deleteMany({
      status: { $in: ["approved", "rejected"] },
    });
    res.json({ message: `Deleted ${result.deletedCount} processed withdrawal records`, count: result.deletedCount });
  })
);

// GET /api/admin/system-health — returns comprehensive server metrics and database health
router.get(
  "/system-health",
  requireOwner,
  asyncHandler(async (req, res) => {
    const memory = process.memoryUsage();
    const dbState = mongoose.connection.readyState;
    const dbStateMap = { 0: "Disconnected", 1: "Connected", 2: "Connecting", 3: "Disconnecting" };

    let totalUsers = 0,
      totalMatches = 0,
      totalTransactions = 0,
      totalWithdrawals = 0,
      totalPaymentOrders = 0,
      totalKycs = 0,
      matchesWithProofImages = 0,
      processedKycsWithImages = 0,
      processedDepositsCount = 0,
      processedWithdrawalsCount = 0;

    try {
      [
        totalUsers,
        totalMatches,
        totalTransactions,
        totalWithdrawals,
        totalPaymentOrders,
        totalKycs,
        matchesWithProofImages,
        processedKycsWithImages,
        processedDepositsCount,
        processedWithdrawalsCount,
      ] = await Promise.all([
        User.countDocuments(),
        Match.countDocuments(),
        Transaction.countDocuments(),
        Withdrawal.countDocuments(),
        PaymentOrder.countDocuments(),
        Kyc.countDocuments(),
        Match.countDocuments({
          status: { $in: ["COMPLETED", "SETTLED", "CANCELLED", "REFUNDED"] },
          "resultProof.0": { $exists: true },
        }),
        Kyc.countDocuments({
          status: { $in: ["verified", "rejected"] },
          aadhaarImageUrl: { $nin: ["", null] },
        }),
        PaymentOrder.countDocuments({ status: { $in: ["success", "failed"] } }),
        Withdrawal.countDocuments({ status: { $in: ["approved", "rejected"] } }),
      ]);
    } catch (err) {
      console.error("System health count error:", err);
    }

    res.json({
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || "development",
      nodeVersion: process.version,
      memory: {
        rssMb: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
        heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
      },
      database: {
        status: dbStateMap[dbState] || "Unknown",
        readyState: dbState,
        host: mongoose.connection.host || "N/A",
        name: mongoose.connection.name || "N/A",
      },
      counts: {
        users: totalUsers,
        matches: totalMatches,
        transactions: totalTransactions,
        withdrawals: totalWithdrawals,
        paymentOrders: totalPaymentOrders,
        kycs: totalKycs,
      },
      cleanableStorage: {
        matchProofImages: matchesWithProofImages,
        kycImages: processedKycsWithImages,
        processedDeposits: processedDepositsCount,
        processedWithdrawals: processedWithdrawalsCount,
      },
    });
  })
);

// GET /api/admin/server-ip — checks and returns the backend server's current public outbound IP via Fixie Proxy
router.get(
  "/server-ip",
  asyncHandler(async (req, res) => {
    let outboundIp = null;
    let errorDetail = null;

    const proxyUrl = getProxyUrl();
    const agent = getProxyAgent();

    const fetchIp = async (url) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const fetchOptions = { signal: controller.signal };
        if (agent) fetchOptions.agent = agent;
        const response = await fetch(url, fetchOptions);
        const text = await response.text();
        try {
          const json = JSON.parse(text);
          return json.ip || json.ip_addr || text.trim();
        } catch {
          return text.trim();
        }
      } finally {
        clearTimeout(timeout);
      }
    };

    try {
      outboundIp = await fetchIp("https://api.ipify.org?format=json");
    } catch (err1) {
      try {
        outboundIp = await fetchIp("https://icanhazip.com");
      } catch (err2) {
        errorDetail = err2.message || err1.message;
      }
    }

    let proxyHost = null;
    if (proxyUrl) {
      try {
        const parsed = new URL(proxyUrl);
        proxyHost = parsed.hostname;
      } catch {
        // ignore
      }
    }

    res.json({
      outboundIp: outboundIp || "Unable to detect IP",
      isProxyActive: Boolean(agent),
      proxyUrlConfigured: Boolean(proxyUrl),
      proxyHost: proxyHost || (agent ? "Fixie Static Proxy" : null),
      errorDetail,
      message: agent
        ? "Fixie Static Proxy is ACTIVE. Give this exact IP address to your KYC & payment provider for whitelisting."
        : "Direct IP (Fixie Proxy not configured).",
    });
  })
);

// GET /api/admin/logs — Paginated admin logs
router.get(
  "/logs",
  requireOwner,
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const adminId = req.query.adminId;
    
    const query = {};
    if (adminId) query.adminId = adminId;
    
    const logs = await AdminLog.find(query)
      .populate("adminId", "name phone role")
      .populate("targetUser", "name phone")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
      
    const total = await AdminLog.countDocuments(query);
    
    res.json({ logs, total, page, totalPages: Math.ceil(total / limit) });
  })
);

// GET /api/admin/logs/stats — Daily metrics
router.get(
  "/logs/stats",
  requireOwner,
  asyncHandler(async (req, res) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const stats = await AdminLog.aggregate([
      { $match: { createdAt: { $gte: startOfDay } } },
      { $group: { _id: "$adminId", actionsToday: { $sum: 1 } } },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "admin" } },
      { $unwind: "$admin" },
      { $project: { _id: 1, name: "$admin.name", role: "$admin.role", actionsToday: 1 } },
      { $sort: { actionsToday: -1 } }
    ]);
    
    res.json(stats);
  })
);

// DELETE /api/admin/maintenance/purge
router.delete(
  "/maintenance/purge",
  requireMaster,
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 20;
    if (days < 1) {
      return res.status(400).json({ message: "Days must be at least 1" });
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Delete records older than cutoff
    const results = {};

    results.matches = await Match.deleteMany({ createdAt: { $lt: cutoff } });
    results.transactions = await Transaction.deleteMany({ createdAt: { $lt: cutoff } });
    results.notifications = await Notification.deleteMany({ createdAt: { $lt: cutoff } });
    results.paymentOrders = await PaymentOrder.deleteMany({ createdAt: { $lt: cutoff } });
    results.withdrawals = await Withdrawal.deleteMany({ createdAt: { $lt: cutoff } });
    results.supportTickets = await SupportTicket.deleteMany({ createdAt: { $lt: cutoff } });
    results.adminLogs = await AdminLog.deleteMany({ createdAt: { $lt: cutoff } });

    await logAdminAction(req, "DB_PURGE", `Purged database records older than ${days} days (${cutoff.toISOString()})`);

    res.json({
      message: `Successfully deleted records older than ${days} days.`,
      cutoff: cutoff,
      deletedCounts: {
        matches: results.matches.deletedCount,
        transactions: results.transactions.deletedCount,
        notifications: results.notifications.deletedCount,
        deposits: results.paymentOrders.deletedCount,
        withdrawals: results.withdrawals.deletedCount,
        supportTickets: results.supportTickets.deletedCount,
        adminLogs: results.adminLogs.deletedCount,
      }
    });
  })
);

// GET /api/admin/contacts
router.get(
  "/contacts",
  requireAnyAdmin,
  asyncHandler(async (req, res) => {
    // We want to fetch all UserContacts but ONLY those whose phone does NOT exist in the User collection.
    const contacts = await UserContact.aggregate([
      {
        $lookup: {
          from: "users",
          let: { phoneNo: "$phone" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: [{ $type: "$phone" }, "string"] },
                    { $eq: [{ $type: "$$phoneNo" }, "string"] },
                    {
                      $regexMatch: {
                        input: "$phone",
                        regex: { $concat: ["", "$$phoneNo", "$"] }
                      }
                    }
                  ]
                }
              }
            }
          ],
          as: "matchedUsers"
        }
      },
      {
        $match: {
          matchedUsers: { $size: 0 }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "fetchedBy",
          foreignField: "_id",
          as: "fetcher"
        }
      },
      {
        $unwind: "$fetcher"
      },
      {
        $project: {
          _id: 1,
          name: 1,
          phone: 1,
          fetchedBy: "$fetcher.name",
          fetchedByPhone: "$fetcher.phone",
          createdAt: 1
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    res.json(contacts);
  })
);

export default router;
