import { Router } from "express";
import { requireAuth, requireActiveWallet } from "../middleware/authMiddleware.js";
import { requireFields } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createImbOrder, checkImbOrderStatus, isImbStatusSuccess, isImbStatusFailed, generateOrderId } from "../utils/paymentGateway.js";
import { getSiteSettings } from "../utils/siteSettings.js";
import PaymentOrder, { PAYMENT_ORDER_STATUS } from "../models/PaymentOrder.js";
import { markPaymentOrderSuccessAndCredit } from "../utils/paymentLedger.js";

const router = Router();

const MOBILE_REGEX = /^[6-9]\d{9}$/;
const ORDER_ID_REGEX = /^[A-Za-z0-9_-]{4,40}$/;

function normalizeMobile(raw) {
  return String(raw || "").replace(/\D/g, "").slice(-10);
}

// POST /api/payment/callback
// IMB Webhook endpoint to receive real-time payment status updates.
// Automatically verifies status with IMB server-side to prevent forged callbacks.
router.post(
  "/callback",
  asyncHandler(async (req, res) => {
    console.log("IMB Webhook received payload:", req.body);

    const orderId = req.body.order_id || req.body.client_txn_id || req.body.orderId;
    if (!orderId) {
      console.warn("IMB Webhook missing order_id. Payload:", req.body);
      return res.status(200).json({ message: "Acknowledged, missing order_id" });
    }

    const existingOrder = await PaymentOrder.findOne({ orderId });
    if (!existingOrder) {
      console.warn(`IMB Webhook received for unknown order: ${orderId}`);
      return res.status(200).json({ message: "Order not found" });
    }

    if (existingOrder.creditedAt) {
      console.log(`IMB Webhook: Order ${orderId} is already credited.`);
      return res.status(200).json({ status: "success", message: "Already processed" });
    }

    // Direct Server-to-Server Verification with IMB
    try {
      const verifiedData = await checkImbOrderStatus(orderId);
      console.log(`IMB Check Status verification for ${orderId}:`, verifiedData);

      if (isImbStatusSuccess(verifiedData)) {
        existingOrder.imbResponse = verifiedData;
        await existingOrder.save();

        const order = await markPaymentOrderSuccessAndCredit(orderId, { note: "Payment top-up (Verified Webhook)" });
        if (order) {
          console.log(`Payment verified and wallet credited for order: ${orderId}`);
        }
      } else if (isImbStatusFailed(verifiedData)) {
        await PaymentOrder.updateOne(
          { orderId, creditedAt: null },
          { $set: { status: PAYMENT_ORDER_STATUS.FAILED, imbResponse: verifiedData } }
        );
        console.log(`Payment verified as failed for order: ${orderId}`);
      }
    } catch (verifyErr) {
      console.error(`Failed to verify payment status with IMB for ${orderId}:`, verifyErr.message);
      // Fail safely: record webhook payload without blindly crediting coins
      await PaymentOrder.updateOne(
        { orderId, creditedAt: null },
        { $set: { imbResponse: { webhookPayload: req.body, verificationError: verifyErr.message } } }
      );
    }

    res.status(200).json({ status: "success", message: "Webhook processed" });
  })
);

// Every route below only ever reads/writes orders owned by req.user.id (from
// the verified JWT) — there is no :userId param, so a user can never reach
// anyone else's payment order.
router.use(requireAuth);

// POST /api/payment/create-order — creates a pending PaymentOrder record,
// then asks IMB to create the matching order. The wallet is NEVER credited
// here — only a verified payment can do that (see utils/paymentLedger.js).
router.post(
  "/create-order",
  requireFields("amount", "customer_mobile", "redirect_url"),
  requireActiveWallet,
  asyncHandler(async (req, res) => {
    const amount = Number(req.body.amount);
    const customerMobile = normalizeMobile(req.body.customer_mobile);
    const redirectUrl = String(req.body.redirect_url).trim();
    const remark1 = String(req.body.remark1 || "Wallet top-up").trim();
    const remark2 = String(req.body.remark2 || String(req.user.id)).trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "Amount must be a valid positive amount" });
    }
    const settings = await getSiteSettings();
    if (amount < settings.minDeposit || amount > settings.maxDeposit) {
      return res
        .status(400)
        .json({ message: `Amount must be between ${settings.minDeposit} and ${settings.maxDeposit}` });
    }
    if (!MOBILE_REGEX.test(customerMobile)) {
      return res.status(400).json({ message: "Please provide a valid 10-digit mobile number" });
    }

    let redirectUrlObj;
    try {
      redirectUrlObj = new URL(redirectUrl);
    } catch {
      return res.status(400).json({ message: "redirect_url must be a valid absolute URL" });
    }
    if (!["http:", "https:"].includes(redirectUrlObj.protocol)) {
      return res.status(400).json({ message: "redirect_url must use http or https" });
    }

    const requestedOrderId = req.body.order_id ? String(req.body.order_id).trim() : "";
    if (requestedOrderId && !ORDER_ID_REGEX.test(requestedOrderId)) {
      return res
        .status(400)
        .json({ message: "order_id must be 4-40 characters: letters, numbers, - or _ only" });
    }
    const orderId = requestedOrderId || generateOrderId();

    let order;
    try {
      order = await PaymentOrder.create({
        user: req.user.id,
        orderId,
        amount,
        customerMobile,
        redirectUrl,
        remark1,
        remark2,
        status: PAYMENT_ORDER_STATUS.PENDING,
      });
    } catch (err) {
      if (err?.code === 11000) {
        return res.status(409).json({ message: "This order_id is already in use. Please retry with a different order_id." });
      }
      throw err;
    }

    let gatewayResult;
    try {
      gatewayResult = await createImbOrder({ customerMobile, amount, orderId, redirectUrl, remark1, remark2 });
    } catch (err) {
      order.status = PAYMENT_ORDER_STATUS.FAILED;
      order.imbResponse = { error: err.message };
      await order.save();
      throw err;
    }

    const { raw, paymentUrl, isExplicitFailure } = gatewayResult;

    order.imbResponse = raw;
    order.paymentUrl = paymentUrl || "";
    order.status = isExplicitFailure ? PAYMENT_ORDER_STATUS.FAILED : PAYMENT_ORDER_STATUS.PENDING;
    await order.save();

    if (isExplicitFailure) {
      return res.status(502).json({
        message: raw?.message || "Payment provider declined to create this order",
        orderId: order.orderId,
      });
    }

    res.status(201).json({
      orderId: order.orderId,
      amount: order.amount,
      status: order.status,
      paymentUrl: order.paymentUrl || null,
      imbResponse: raw,
    });
  })
);

// GET /api/payment/order/:orderId — the current user's own order status only.
router.get(
  "/order/:orderId",
  asyncHandler(async (req, res) => {
    let order = await PaymentOrder.findOne({ orderId: req.params.orderId, user: req.user.id });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status === PAYMENT_ORDER_STATUS.PENDING && !order.creditedAt) {
      try {
        const verifiedData = await checkImbOrderStatus(order.orderId);
        if (isImbStatusSuccess(verifiedData)) {
          order.imbResponse = verifiedData;
          await order.save();
          const creditedOrder = await markPaymentOrderSuccessAndCredit(order.orderId, { note: "Payment top-up (Live User Check)" });
          if (creditedOrder) {
            order = creditedOrder;
          } else {
            order = (await PaymentOrder.findOne({ orderId: req.params.orderId, user: req.user.id })) || order;
          }
        } else if (isImbStatusFailed(verifiedData)) {
          order.status = PAYMENT_ORDER_STATUS.FAILED;
          order.imbResponse = verifiedData;
          await order.save();
        }
      } catch (err) {
        console.error(`Live status check error for order ${order.orderId}:`, err.message);
      }
    }

    res.json({
      orderId: order.orderId,
      amount: order.amount,
      status: order.status,
      paymentUrl: order.paymentUrl || null,
      createdAt: order.createdAt,
    });
  })
);

export default router;
