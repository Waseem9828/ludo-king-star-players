import mongoose from "mongoose";

// One KYC record per user — resubmitting (e.g. after rejection) updates this
// same document rather than creating a new one, so there's always exactly
// one current status to check before a withdrawal.
const kycSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    aadhaarNumber: { type: String, required: true },
    name: { type: String, default: "" },
    dob: { type: String, default: "" },
    gender: { type: String, default: "" },
    address: { type: String, default: "" },
    careOf: { type: String, default: "" },
    pincode: { type: String, default: "" },
    state: { type: String, default: "" },
    aadhaarImageUrl: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    submittedAt: { type: Date, default: Date.now },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

kycSchema.index({ status: 1, createdAt: -1 });
kycSchema.index({ aadhaarNumber: 1, status: 1 });

export default mongoose.model("Kyc", kycSchema);
