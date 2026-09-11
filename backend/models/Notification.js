import mongoose from "mongoose";

export const NOTIFICATION_TYPE = Object.freeze({
  DEPOSIT_APPROVED: "DEPOSIT_APPROVED",
  DEPOSIT_REJECTED: "DEPOSIT_REJECTED",
  WITHDRAWAL_APPROVED: "WITHDRAWAL_APPROVED",
  WITHDRAWAL_REJECTED: "WITHDRAWAL_REJECTED",
  MATCH_WON: "MATCH_WON",
  MATCH_LOST: "MATCH_LOST",
  MATCH_JOINED: "MATCH_JOINED",
  MATCH_CANCELLED: "MATCH_CANCELLED",
  REFERRAL_BONUS: "REFERRAL_BONUS",
  PROMO_REDEEMED: "PROMO_REDEEMED",
  KYC_VERIFIED: "KYC_VERIFIED",
  KYC_REJECTED: "KYC_REJECTED",
  ANNOUNCEMENT: "ANNOUNCEMENT",
});

// One row per (user, event) — every user gets their own read state, even
// for a broadcast announcement, so "mark as read" never affects anyone else.
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPE),
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, default: "" },
    isRead: { type: Boolean, default: false },
    match: { type: mongoose.Schema.Types.ObjectId, ref: "Match", default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1 });
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
