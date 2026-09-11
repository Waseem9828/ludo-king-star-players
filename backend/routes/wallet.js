import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireFields } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getOrCreateWallet } from "../utils/coinLedger.js";
import Transaction from "../models/Transaction.js";
import DepositMethod from "../models/DepositMethod.js";
import PayoutMethod from "../models/PayoutMethod.js";

const router = Router();

// Every route below only ever reads/writes req.user.id (from the verified
// JWT) — there is no :userId param, so a user can never reach anyone else's
// wallet or history through this router.
router.use(requireAuth);

function toWalletResponse(wallet) {
  return {
    totalCoins: wallet.totalCoins,
    depositCoins: wallet.depositCoins,
    winningCoins: wallet.winningCoins,
    bonusCoins: wallet.bonusCoins,
    updatedAt: wallet.updatedAt,
  };
}

// GET /api/wallet — current user's balances.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const wallet = await getOrCreateWallet(req.user.id);
    res.json(toWalletResponse(wallet));
  })
);

// GET /api/wallet/history — current user's Coin History, newest first.
router.get(
  "/history",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);

    const transactions = await Transaction.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(
      transactions.map((tx) => ({
        id: tx._id,
        type: tx.type,
        bucket: tx.bucket,
        amount: tx.amount,
        balanceAfter: tx.balanceAfter,
        breakdown: tx.breakdown || undefined,
        note: tx.note,
        match: tx.match,
        createdAt: tx.createdAt,
      }))
    );
  })
);

// GET /api/wallet/deposit-methods — active admin-configured "send money
// here" destinations (manual/alternative deposit channels alongside the
// automatic IMB gateway flow in routes/payment.js).
router.get(
  "/deposit-methods",
  asyncHandler(async (req, res) => {
    const methods = await DepositMethod.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
    res.json(methods);
  })
);

function extractPayoutDetails(body) {
  const method = body.method;
  if (method === "upi") {
    return { upiId: String(body.upiId || "").trim() };
  }
  return {
    accountHolderName: String(body.accountHolderName || "").trim(),
    accountNumber: String(body.accountNumber || "").trim(),
    ifsc: String(body.ifsc || "").trim(),
  };
}

// GET /api/wallet/payout-methods — the current user's own saved withdrawal
// destinations only.
router.get(
  "/payout-methods",
  asyncHandler(async (req, res) => {
    const methods = await PayoutMethod.find({ user: req.user.id }).sort({ isDefault: -1, createdAt: -1 });
    res.json(methods);
  })
);

// POST /api/wallet/payout-methods — save a new withdrawal destination.
router.post(
  "/payout-methods",
  requireFields("method"),
  asyncHandler(async (req, res) => {
    const { method } = req.body;
    if (!["upi", "bank"].includes(method)) {
      return res.status(400).json({ message: "method must be 'upi' or 'bank'" });
    }

    const details = extractPayoutDetails(req.body);
    if (method === "upi" && !details.upiId) {
      return res.status(400).json({ message: "UPI ID is required" });
    }
    if (method === "bank" && (!details.accountHolderName || !details.accountNumber || !details.ifsc)) {
      return res
        .status(400)
        .json({ message: "Account holder name, account number and IFSC are required" });
    }

    const label = String(req.body.label || "").trim();
    const makeDefault = Boolean(req.body.isDefault);

    if (makeDefault) {
      await PayoutMethod.updateMany({ user: req.user.id }, { $set: { isDefault: false } });
    }

    const payoutMethod = await PayoutMethod.create({
      user: req.user.id,
      method,
      label,
      ...details,
      isDefault: makeDefault,
    });

    res.status(201).json(payoutMethod);
  })
);

// PATCH /api/wallet/payout-methods/:id/default — mark one saved method as
// the default; unmarks any other default the user had.
router.patch(
  "/payout-methods/:id/default",
  asyncHandler(async (req, res) => {
    const target = await PayoutMethod.findOne({ _id: req.params.id, user: req.user.id });
    if (!target) {
      return res.status(404).json({ message: "Payment method not found" });
    }

    await PayoutMethod.updateMany({ user: req.user.id }, { $set: { isDefault: false } });
    target.isDefault = true;
    await target.save();

    res.json(target);
  })
);

// DELETE /api/wallet/payout-methods/:id
router.delete(
  "/payout-methods/:id",
  asyncHandler(async (req, res) => {
    const deleted = await PayoutMethod.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!deleted) {
      return res.status(404).json({ message: "Payment method not found" });
    }
    res.json({ message: "Payment method removed" });
  })
);

export default router;
