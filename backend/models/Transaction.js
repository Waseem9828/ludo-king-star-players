import mongoose from "mongoose";

export const TRANSACTION_TYPE = Object.freeze({
  BATTLE_ENTRY: "BATTLE_ENTRY",
  BATTLE_REFUND: "BATTLE_REFUND",
  BATTLE_PRIZE: "BATTLE_PRIZE",
  WALLET_TOPUP: "WALLET_TOPUP",
  WELCOME_BONUS: "WELCOME_BONUS",
  REFERRAL_BONUS: "REFERRAL_BONUS",
  WITHDRAWAL_REQUEST: "WITHDRAWAL_REQUEST",
  WITHDRAWAL_REFUND: "WITHDRAWAL_REFUND",
  ADMIN_ADJUSTMENT: "ADMIN_ADJUSTMENT",
  ADMIN_BONUS: "ADMIN_BONUS",
  ADMIN_PENALTY: "ADMIN_PENALTY",
  PROMO_BONUS: "PROMO_BONUS",
  BATTLE_ERROR_REFUND: "BATTLE_ERROR_REFUND",
  SYSTEM_ERROR_COMPENSATION: "SYSTEM_ERROR_COMPENSATION",
  MANUAL_DEPOSIT: "MANUAL_DEPOSIT",
  TOURNAMENT_PRIZE: "TOURNAMENT_PRIZE",
  MATCH_REFERRAL_COMMISSION: "MATCH_REFERRAL_COMMISSION",
});

// Which wallet bucket a transaction affected. "mixed" is used for spends
// (e.g. battle entry) that draw from more than one bucket in one action —
// see `breakdown` below for the per-bucket split.
export const WALLET_BUCKET = Object.freeze({
  DEPOSIT: "deposit",
  WINNING: "winning",
  BONUS: "bonus",
  MIXED: "mixed",
});

// Auditable record of every virtual-coin balance change — this IS the Coin
// History. No real money is ever represented here — amounts are always
// in-app virtual coins. Each document's own _id is the unique
// transaction/reference ID.
const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: Object.values(TRANSACTION_TYPE),
      required: true,
    },
    bucket: {
      type: String,
      enum: Object.values(WALLET_BUCKET),
      required: true,
    },
    amount: { type: Number, required: true }, // positive = credit, negative = debit
    balanceAfter: { type: Number, required: true, min: 0 }, // totalCoins after this transaction
    // Only set when `bucket` is "mixed" — how much of the amount came from
    // each bucket, e.g. a battle entry paid partly from bonus, partly deposit.
    breakdown: {
      type: new mongoose.Schema(
        {
          depositCoins: { type: Number, default: 0 },
          winningCoins: { type: Number, default: 0 },
          bonusCoins: { type: Number, default: 0 },
        },
        { _id: false }
      ),
      default: undefined,
    },
    match: { type: mongoose.Schema.Types.ObjectId, ref: "Match", default: null },
    note: { type: String, default: "" },
    // Idempotency key (e.g. `welcome_bonus:USER_ID`) to guarantee no duplicate bonus/payouts
    reference: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ type: 1, createdAt: -1 });
transactionSchema.index({ user: 1, type: 1, createdAt: -1 });

export default mongoose.model("Transaction", transactionSchema);
