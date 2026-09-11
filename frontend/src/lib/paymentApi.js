import { apiRequest } from "./apiClient.js";

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Creates a real IMB payment order and returns { orderId, amount, status,
// paymentUrl, imbResponse } — paymentUrl is where the browser should be
// sent to complete the payment.
export function createPaymentOrder(token, { amount, customerMobile, redirectUrl, orderId }) {
  return apiRequest("/payment/create-order", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({
      amount,
      customer_mobile: customerMobile,
      redirect_url: redirectUrl,
      ...(orderId ? { order_id: orderId } : {}),
    }),
  });
}

export function getPaymentOrderStatus(token, orderId) {
  return apiRequest(`/payment/order/${orderId}`, { headers: authHeader(token) });
}
