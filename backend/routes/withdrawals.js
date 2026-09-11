import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireFields } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { debitWinningCoins, creditCoins } from "../utils/coinLedger.js";
import { TRANSACTION_TYPE } from "../models/Transaction.js";
import { MIN_WITHDRAWAL_COINS } from "../config/gameConfig.js";
import Withdrawal from "../models/Withdrawal.js";
import Kyc from "../models/Kyc.js";
import { getSiteSettings } from "../utils/siteSettings.js";

const router = Router();

router.use(requireAuth);

// POST /api/withdrawals — request a withdrawal from winning coins only.
// The amount is deducted immediately (server-side, atomically) so it can't
// be spent elsewhere while the request is pending; it's refunded if an
// admin later rejects the request. Never marked SUCCESS just because the
// client submitted it — only PENDING here, admin decides the rest.
router.post(
  "/",
  requireFields("amount", "payoutMethod"),
  asyncHandler(async (req, res) => {
    const amount = Number(req.body.amount);
    const { payoutMethod } = req.body;

    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive whole number of coins" });
    }
    
    const settings = await getSiteSettings();

// Withdrawal time window enforcement
const now = new Date();
const nowTime = now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");
const start = settings.withdrawalStartTime || "00:00";
const end = settings.withdrawalEndTime || "23:59";
function timeInRange(current, start, end) {
  if (start <= end) {
    return current >= start && current <= end;
  }
  // window wraps midnight
  return current >= start || current <= end;
}
if (!timeInRange(nowTime, start, end)) {
  return res.status(403).json({ message: `Withdrawals are only allowed between ${start} and ${end}` });
}

if (amount < settings.minWithdrawal) {
  return res.status(400).json({ message: `Minimum withdrawal is ${settings.minWithdrawal} chips` });
}
if (amount > settings.maxWithdrawal) {
  return res.status(400).json({ message: `Maximum withdrawal is ${settings.maxWithdrawal} chips` });
}
if (!["upi", "bank"].includes(payoutMethod)) {
  return res.status(400).json({ message: "payoutMethod must be 'upi' or 'bank'" });
}

    const kyc = await Kyc.findOne({ user: req.user.id });
    if (!kyc || kyc.status !== "verified") {
      return res.status(403).json({ message: "KYC verification required before withdrawal" });
    }

    const payoutDetails = {};
    if (payoutMethod === "upi") {
      const upiId = (req.body.upiId || "").trim();
      if (!upiId) {
        return res.status(400).json({ message: "UPI ID is required" });
      }
      payoutDetails.upiId = upiId;
    } else {
      const accountHolderName = (req.body.accountHolderName || "").trim();
      const accountNumber = (req.body.accountNumber || "").trim();
      const ifsc = (req.body.ifsc || "").trim();
      if (!accountHolderName || !accountNumber || !ifsc) {
        return res
          .status(400)
          .json({ message: "Account holder name, account number and IFSC are required" });
      }
      Object.assign(payoutDetails, { accountHolderName, accountNumber, ifsc });
    }

    const existingPending = await Withdrawal.findOne({ user: req.user.id, status: "pending" });
    if (existingPending) {
      return res.status(409).json({ message: "You already have a pending withdrawal request" });
    }
    
    if (settings.withdrawalCooldownHours > 0) {
      const lastWithdrawal = await Withdrawal.findOne({ user: req.user.id })
        .sort({ createdAt: -1 })
        .select("createdAt");
        
      if (lastWithdrawal) {
        const timeSinceLast = Date.now() - lastWithdrawal.createdAt.getTime();
        const cooldownMs = settings.withdrawalCooldownHours * 60 * 60 * 1000;
        if (timeSinceLast < cooldownMs) {
          const hoursLeft = Math.ceil((cooldownMs - timeSinceLast) / (60 * 60 * 1000));
          return res.status(429).json({ 
            message: `Please wait ${hoursLeft} hour(s) before making another withdrawal request.` 
          });
        }
      }
    }

    const wallet = await debitWinningCoins(req.user.id, amount, {
      type: TRANSACTION_TYPE.WITHDRAWAL_REQUEST,
      note: "Withdrawal request",
    });
    if (!wallet) {
      return res.status(400).json({ message: "Insufficient winning balance" });
    }

    let withdrawal;
    try {
      withdrawal = await Withdrawal.create({
        user: req.user.id,
        amount,
        payoutMethod,
        payoutDetails,
        status: "pending",
      });
    } catch (err) {
      // Something went wrong recording the request after the coins were
      // already taken — give them back immediately with idempotent reference
      await creditCoins(req.user.id, amount, {
        type: TRANSACTION_TYPE.WITHDRAWAL_REFUND,
        note: "Refund: withdrawal request conflict/failed to record",
        reference: `withdrawal_fail_refund:${req.user.id}:${Date.now()}`,
      });

      if (err?.code === 11000) {
        return res.status(409).json({ message: "You already have an active pending withdrawal request." });
      }
      throw err;
    }

    res.status(201).json(withdrawal);
  })
);

// GET /api/withdrawals — the current user's own withdrawal history only.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const withdrawals = await Withdrawal.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(withdrawals);
  })
);

export default router;
