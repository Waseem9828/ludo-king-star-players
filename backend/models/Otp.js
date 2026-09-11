import mongoose from "mongoose";

export const OTP_PURPOSE = Object.freeze({
  REGISTER: "register",
  LOGIN: "login",
  AUTH: "auth",
});

// One active OTP per (phone, purpose) — sending a new one replaces it
// (see utils/otpService.js). For REGISTER, the signup details wait here,
// unhashed password never included, until the OTP is verified — no User
// document is created until then.
const otpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true },
    purpose: { type: String, enum: Object.values(OTP_PURPOSE), required: true },
    otpHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    pendingRegistration: {
      name: String,
      passwordHash: String,
      referralCode: String,
    },
  },
  { timestamps: true }
);

otpSchema.index({ phone: 1, purpose: 1 }, { unique: true });
// TTL cleanup — Mongo removes the doc automatically once expiresAt passes.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Otp", otpSchema);
