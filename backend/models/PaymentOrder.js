import mongoose from "mongoose";

export const PAYMENT_ORDER_STATUS = Object.freeze({
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
});

// One document per IMB order, created before the create-order call is even
// made — so a crash/retry never loses track of an order_id, and duplicate
// order_ids are rejected by the unique index below. `creditedAt` is the
// idempotency guard (see utils/paymentLedger.js): nothing may credit a
// user's wallet twice for the same order.
const paymentOrderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true, min: 1 },
    customerMobile: { type: String, required: true },
    redirectUrl: { type: String, required: true },
    remark1: { type: String, default: "" },
    remark2: { type: String, default: "" },
    status: {
      type: String,
      enum: Object.values(PAYMENT_ORDER_STATUS),
      default: PAYMENT_ORDER_STATUS.PENDING,
    },
    paymentUrl: { type: String, default: "" },
    // Raw create-order response from IMB, kept for support/debugging. Never
    // contains the API token — that's only ever sent, never echoed back.
    imbResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    creditedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

paymentOrderSchema.index({ user: 1, createdAt: -1 });
paymentOrderSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("PaymentOrder", paymentOrderSchema);
