import PaymentOrder, { PAYMENT_ORDER_STATUS } from "../models/PaymentOrder.js";
import { creditCoins } from "./coinLedger.js";
import { TRANSACTION_TYPE } from "../models/Transaction.js";

// Marks a PaymentOrder as successful and credits the matching coins to the
// user's wallet — exactly once per order, no matter how many times this is
// called (e.g. a webhook retry racing a manual status check). The atomic
// findOneAndUpdate guard below (creditedAt: null in the filter) is what
// makes that safe: only the caller that flips creditedAt from null wins.
//
// NOT YET CALLED from any route. IMB's Check Status API and webhook
// contract were not part of the documentation provided for this
// integration, and the brief was explicit not to invent either — a payment
// must only be marked successful after genuine IMB verification. Wire this
// up from that verification code once IMB's real endpoint/payload for it is
// available. Never call this from a client-triggered request directly —
// the client cannot be trusted to say its own payment succeeded.
export async function markPaymentOrderSuccessAndCredit(orderId, { note = "Payment top-up" } = {}) {
  const order = await PaymentOrder.findOneAndUpdate(
    { orderId, creditedAt: null },
    { status: PAYMENT_ORDER_STATUS.SUCCESS, creditedAt: new Date() },
    { new: true }
  );

  // Either the order doesn't exist, or it was already credited — either way
  // there is nothing left to do. Returning null (rather than throwing) keeps
  // this safe to call redundantly.
  if (!order) return null;

  let utr = "";
  if (order.imbResponse) {
    const res = order.imbResponse;
    const data = res.data || res;
    utr = data.upi_txn_id || data.utr || data.UTR || data.bank_ref_num || "";
  }
  
  const finalNote = utr ? `UTR: ${utr}` : note;

  await creditCoins(order.user, order.amount, {
    type: TRANSACTION_TYPE.WALLET_TOPUP,
    note: finalNote,
    reference: `payment_topup:${order.orderId}`,
  });

  return order;
}
