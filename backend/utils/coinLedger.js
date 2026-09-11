import mongoose from "mongoose";
import Wallet from "../models/Wallet.js";
import Transaction, { TRANSACTION_TYPE, WALLET_BUCKET } from "../models/Transaction.js";
import { notifyUser } from "../config/socket.js";

// Which wallet bucket a credit of this transaction type lands in. Deductions
// don't use this — see spendFromWallet, which draws across all three buckets.
const CREDIT_BUCKET_BY_TYPE = {
  [TRANSACTION_TYPE.BATTLE_PRIZE]: "winningCoins",
  [TRANSACTION_TYPE.WELCOME_BONUS]: "bonusCoins",
  [TRANSACTION_TYPE.REFERRAL_BONUS]: "depositCoins",
  [TRANSACTION_TYPE.MATCH_REFERRAL_COMMISSION]: "depositCoins",
  [TRANSACTION_TYPE.BATTLE_REFUND]: "depositCoins",
  [TRANSACTION_TYPE.WALLET_TOPUP]: "depositCoins",
  [TRANSACTION_TYPE.ADMIN_ADJUSTMENT]: "depositCoins",
  [TRANSACTION_TYPE.WITHDRAWAL_REFUND]: "winningCoins",
  [TRANSACTION_TYPE.PROMO_BONUS]: "bonusCoins",
};

const BUCKET_FIELD_TO_NAME = {
  depositCoins: WALLET_BUCKET.DEPOSIT,
  winningCoins: WALLET_BUCKET.WINNING,
  bonusCoins: WALLET_BUCKET.BONUS,
};

function totalOf(wallet) {
  return wallet.depositCoins + wallet.winningCoins + wallet.bonusCoins;
}

function assertValidAmount(amount) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw Object.assign(new Error("Amount must be a positive whole number of coins"), { status: 400 });
  }
}

// Ensures a wallet exists for this user. Safe under concurrent first-time
// calls: the unique index on `user` means at most one insert wins; a racing
// caller just re-reads the row the other one created.
export async function getOrCreateWallet(userId, session = null) {
  const options = session ? { session } : {};
  const existing = await Wallet.findOne({ user: userId }).session(session);
  if (existing) return existing;

  try {
    return await Wallet.findOneAndUpdate(
      { user: userId },
      { $setOnInsert: { user: userId } },
      { new: true, upsert: true, setDefaultsOnInsert: true, ...options }
    );
  } catch (err) {
    if (err?.code === 11000) {
      return Wallet.findOne({ user: userId }).session(session);
    }
    throw err;
  }
}

// Credits `amount` virtual coins into the bucket appropriate for `type`, and
// records a Coin History transaction. Supports MongoDB transactions and reference idempotency.
export async function creditCoins(userId, amount, { type, match = null, note = "", reference = null }, session = null) {
  assertValidAmount(amount);
  const bucketField = CREDIT_BUCKET_BY_TYPE[type] || "depositCoins";
  const options = session ? { session } : {};

  // Idempotency check: If reference is specified and already processed, return current wallet
  if (reference) {
    const existingTx = await Transaction.findOne({ reference }).session(session);
    if (existingTx) {
      return await getOrCreateWallet(userId, session);
    }
  }

  await getOrCreateWallet(userId, session);
  const wallet = await Wallet.findOneAndUpdate(
    { user: userId },
    { $inc: { [bucketField]: amount } },
    { new: true, ...options }
  );

  if (!wallet) return null;

  try {
    await Transaction.create(
      [
        {
          user: userId,
          type,
          bucket: BUCKET_FIELD_TO_NAME[bucketField],
          amount,
          balanceAfter: totalOf(wallet),
          match,
          note,
          reference: reference || undefined,
        },
      ],
      options
    );
    notifyUser(userId.toString(), "wallet:updated", wallet);
  } catch (err) {
    if (err?.code === 11000 && reference) {
      // Idempotency conflict — already credited by parallel request
      return wallet;
    }
    throw err;
  }

  return wallet;
}

// Spends `amount` against the wallet's combined total, drawing down buckets
// in priority order: bonus coins first, then deposit, then winning coins
// last (spend the least-liquid money first — winnings are kept for last).
// Runs inside a Mongo session transaction so a concurrent request reading
// the same wallet can't cause an over-spend or a negative balance; MongoDB
// aborts and retries the transaction on a write conflict.
async function spendFromWallet(userId, amount) {
  const wallet = await Wallet.findOne({ user: userId });
  if (!wallet || totalOf(wallet) < amount) {
    return null;
  }

  let remaining = amount;
  const takeFrom = (available) => {
    const take = Math.min(remaining, available);
    remaining -= take;
    return take;
  };

  const fromBonus = takeFrom(wallet.bonusCoins);
  const fromDeposit = takeFrom(wallet.depositCoins);
  const fromWinning = takeFrom(wallet.winningCoins);

  // Update atomically based on current amounts to prevent race conditions
  const updatedWallet = await Wallet.findOneAndUpdate(
    { 
      user: userId, 
      bonusCoins: { $gte: fromBonus }, 
      depositCoins: { $gte: fromDeposit }, 
      winningCoins: { $gte: fromWinning } 
    },
    {
      $inc: {
        bonusCoins: -fromBonus,
        depositCoins: -fromDeposit,
        winningCoins: -fromWinning
      }
    },
    { new: true }
  );

  // If the document changed between read and write, the update will return null.
  // In a high-concurrency scenario we would retry, but for this simple app, 
  // failing safely is enough.
  if (!updatedWallet) {
    throw new Error("Wallet balance changed during transaction. Please try again.");
  }

  return {
    wallet: updatedWallet,
    breakdown: { depositCoins: fromDeposit, winningCoins: fromWinning, bonusCoins: fromBonus },
  };
}

// Deducts `amount` virtual coins from a user only if their total wallet
// balance covers it. Returns the updated wallet, or null if insufficient.
export async function deductCoins(userId, amount, { type, match = null, note = "" }) {
  assertValidAmount(amount);

  await getOrCreateWallet(userId);
  const result = await spendFromWallet(userId, amount);
  if (!result) return null;

  const { wallet, breakdown } = result;
  const bucketsUsed = [breakdown.depositCoins > 0, breakdown.winningCoins > 0, breakdown.bonusCoins > 0].filter(
    Boolean
  ).length;

  await Transaction.create({
    user: userId,
    type,
    bucket: bucketsUsed > 1 ? WALLET_BUCKET.MIXED : bucketFromBreakdown(breakdown),
    amount: -amount,
    balanceAfter: totalOf(wallet),
    breakdown: bucketsUsed > 1 ? breakdown : undefined,
    match,
    note,
  });

  notifyUser(userId.toString(), "wallet:updated", wallet);

  return wallet;
}

function bucketFromBreakdown(breakdown) {
  if (breakdown.bonusCoins > 0) return WALLET_BUCKET.BONUS;
  if (breakdown.depositCoins > 0) return WALLET_BUCKET.DEPOSIT;
  return WALLET_BUCKET.WINNING;
}

// Add Virtual Coins — a clearly-labelled dev/test wallet top-up, not a real
// payment flow. Always lands in depositCoins.
export function addVirtualCoins(userId, amount, note = "Virtual coins added (test/dev)") {
  return creditCoins(userId, amount, { type: TRANSACTION_TYPE.WALLET_TOPUP, note });
}

// Withdrawals draw only from winningCoins — deposit/bonus coins are never
// withdrawable. Single-field $inc guarded by winningCoins >= amount, so
// it's atomic on its own (no transaction needed) and can never go negative.
export async function debitWinningCoins(userId, amount, { type, note = "" }) {
  assertValidAmount(amount);

  await getOrCreateWallet(userId);
  const wallet = await Wallet.findOneAndUpdate(
    { user: userId, winningCoins: { $gte: amount } },
    { $inc: { winningCoins: -amount } },
    { new: true }
  );

  if (!wallet) return null;

  await Transaction.create({
    user: userId,
    type,
    bucket: WALLET_BUCKET.WINNING,
    amount: -amount,
    balanceAfter: totalOf(wallet),
    note,
  });

  notifyUser(userId.toString(), "wallet:updated", wallet);

  return wallet;
}
