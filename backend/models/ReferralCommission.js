import mongoose from "mongoose";

const referralCommissionSchema = new mongoose.Schema(
  {
    referrer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    referredUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    match: { type: mongoose.Schema.Types.ObjectId, ref: "Match", required: true },
    baseAmount: { type: Number, required: true }, // eligible winning amount / prize
    commissionPercent: { type: Number, required: true }, // configured % at the time
    commissionAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["CREDITED", "FAILED"],
      default: "CREDITED",
    },
  },
  { timestamps: true }
);

referralCommissionSchema.index({ referrer: 1, createdAt: -1 });

export default mongoose.model("ReferralCommission", referralCommissionSchema);
