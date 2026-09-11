import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    passwordHash: { type: String },
    role: {
      type: String,
      enum: ["user", "admin", "finance_admin", "owner", "master"],
      default: "user",
    },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
    },
    walletFrozen: { type: Boolean, default: false },
    // Unique per-user code others use to refer them. Generated once at
    // registration — never reassigned.
    referralCode: { type: String, unique: true, sparse: true },
    // Set exactly once, at registration, from the referral code (if any)
    // supplied at signup. No route ever updates this afterward, so referral
    // ownership can't be changed or refilled later.
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ createdAt: -1 });

export default mongoose.model("User", userSchema);
