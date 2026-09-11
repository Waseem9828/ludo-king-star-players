import mongoose from "mongoose";

// Admin-managed "send money here" destinations shown to users in the
// deposit request flow — distinct from PayoutMethod, which stores a user's
// own withdrawal details.
const depositMethodSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    method: { type: String, enum: ["upi", "bank"], required: true },
    upiId: { type: String, default: "" },
    accountHolderName: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    ifsc: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

depositMethodSchema.index({ isActive: 1, order: 1 });

export default mongoose.model("DepositMethod", depositMethodSchema);
