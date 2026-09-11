import mongoose from "mongoose";

// One row per successful referral. The unique index on `referredUser` is
// the actual guarantee against duplicate rewards — a user can appear as
// referredUser at most once, ever, even under a concurrent/retried request.
const referralSchema = new mongoose.Schema(
  {
    referrer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    referredUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    referrerRewardCoins: { type: Number, required: true, min: 0 },
    referredUserRewardCoins: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

referralSchema.index({ referredUser: 1 }, { unique: true });
referralSchema.index({ referrer: 1, createdAt: -1 });

export default mongoose.model("Referral", referralSchema);
