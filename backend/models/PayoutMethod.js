import mongoose from "mongoose";

// A user's own saved withdrawal destination — lets them skip re-typing UPI
// or bank details on every withdrawal request. Purely a convenience cache;
// the Withdrawal document still stores its own snapshot of payoutDetails at
// request time, so editing/deleting a saved method never changes past
// requests.
const payoutMethodSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    method: { type: String, enum: ["upi", "bank"], required: true },
    label: { type: String, default: "" },
    upiId: { type: String, default: "" },
    accountHolderName: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    ifsc: { type: String, default: "" },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

payoutMethodSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("PayoutMethod", payoutMethodSchema);
