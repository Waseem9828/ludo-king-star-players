import mongoose from "mongoose";

// Singleton document — lets an admin configure the referral commission system.
// Commission is paid from the platform fee, not deducted from the winner's wallet.
const referralSettingsSchema = new mongoose.Schema(
  {
    commissionEnabled: { type: Boolean, required: true, default: true },
    commissionPercentage: { type: Number, required: true, default: 2, min: 0, max: 100 },
    maxCommissionAmount: { type: Number, required: true, default: 0, min: 0 }, // 0 means no limit
  },
  { timestamps: true }
);

export default mongoose.model("ReferralSettings", referralSettingsSchema);
