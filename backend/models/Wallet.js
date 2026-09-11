import mongoose from "mongoose";

// One wallet per user. totalCoins is intentionally NOT a stored field — it is
// always derived from the three buckets below, so it can never drift out of
// sync with them. All virtual in-app coins; never real currency.
const walletSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    // Add Virtual Coins (dev/test top-ups), refunds and admin adjustments.
    depositCoins: { type: Number, default: 0, min: 0 },
    // Battle prize payouts.
    winningCoins: { type: Number, default: 0, min: 0 },
    // Welcome grant + referral rewards.
    bonusCoins: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

walletSchema.virtual("totalCoins").get(function totalCoins() {
  return this.depositCoins + this.winningCoins + this.bonusCoins;
});

export default mongoose.model("Wallet", walletSchema);
