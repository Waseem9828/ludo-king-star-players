import crypto from "node:crypto";
import fetch from "node-fetch";
import { IMB_REQUEST_TIMEOUT_MS } from "../config/paymentConfig.js";
import { getSiteSettings } from "./siteSettings.js";
import { getProxyAgent } from "./proxyAgent.js";

// IMB Payment Gateway Create Order endpoint — exact URL and form field names
// (customer_mobile, user_token, amount, order_id, redirect_url, remark1,
// remark2) per IMB's docs. Sent as application/x-www-form-urlencoded.
const IMB_CREATE_ORDER_URL = "https://api.imbpay.in/v2/create-order";
const IMB_CHECK_STATUS_URL = "https://api.imbpay.in/v2/check-order-status";

export function generateOrderId() {
  return `ord_${Date.now().toString(36)}_${crypto.randomBytes(6).toString("hex")}`;
}

// IMB's create-order response schema search helper.
// Checks all common field conventions for payment URLs/intent links in Indian payment gateways
function extractPaymentUrl(data) {
  if (!data || typeof data !== "object") return null;

  const candidateKeys = [
    "payment_url", "paymentUrl", "payment_link", "paymentLink",
    "pay_url", "payUrl", "url", "intent_url", "intentUrl",
    "upi_url", "upiUrl", "qr_url", "qrUrl", "checkout_url",
    "checkoutUrl", "gateway_url", "gatewayUrl", "link", "web_url"
  ];

  const searchObjects = [
    data,
    data.result,
    data.data,
    data.payload,
    data.order,
    data.details
  ];

  for (const obj of searchObjects) {
    if (!obj || typeof obj !== "object") continue;
    for (const key of candidateKeys) {
      const val = obj[key];
      if (val && typeof val === "string" && val.trim().length > 0) {
        return val.trim();
      }
    }
  }

  // Recursive fallback: search for any http://, https://, or upi:// URL inside the raw response
  try {
    const jsonStr = JSON.stringify(data);
    const match = jsonStr.match(/"(https?:\/\/[^"]+|upi:\/\/[^"]+)"/i);
    if (match && match[1]) {
      return match[1];
    }
  } catch {
    // Ignore JSON stringify error
  }

  return null;
}

async function fetchImbApi(url, body) {
  const agent = getProxyAgent();

  if (agent) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), IMB_REQUEST_TIMEOUT_MS);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        agent,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.status !== 407 && res.status !== 502 && res.status !== 503 && res.status !== 504) {
        return res;
      }
      console.warn(`Proxy returned HTTP ${res.status}. Falling back to direct connection...`);
    } catch (proxyErr) {
      console.warn("Proxy request failed. Falling back to direct connection:", proxyErr.message);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMB_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

// Calls IMB's create-order API. Throws a safe, user-facing Error (with
// .status) on any failure — the raw provider response/API token are never
// exposed to the client, only logged server-side.
export async function createImbOrder({ customerMobile, amount, orderId, redirectUrl, remark1, remark2 }) {
  const settings = await getSiteSettings();
  const dbToken = String(settings.imbApiToken || "").trim();
  const envToken = String(process.env.IMB_API_TOKEN || process.env.DEPOSIT_API_TOKEN || "").trim();
  const userToken = dbToken || envToken;

  if (!userToken) {
    throw Object.assign(new Error("Payment gateway API token is not configured. Please contact support."), { status: 500 });
  }

  const body = new URLSearchParams({
    customer_mobile: customerMobile,
    user_token: userToken,
    amount: String(amount),
    order_id: orderId,
    redirect_url: redirectUrl,
    remark1,
    remark2,
  });

  let res;
  try {
    res = await fetchImbApi(IMB_CREATE_ORDER_URL, body);
  } catch (err) {
    if (err.name === "AbortError") {
      console.error("IMB create-order request timed out");
      throw Object.assign(new Error("Payment provider timed out. Please try again."), { status: 504 });
    }
    console.error("IMB create-order request failed:", err.message);
    throw Object.assign(new Error("Unable to reach the payment provider. Please try again."), { status: 503 });
  }

  const rawText = await res.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    console.error("IMB create-order returned a non-JSON response:", res.status, rawText);
    throw Object.assign(new Error("Payment provider returned an unexpected response. Please try again."), {
      status: 502,
    });
  }

  if (res.status === 401 || res.status === 403) {
    console.error("IMB create-order rejected the API token:", res.status, rawText);
    throw Object.assign(new Error("Payment provider rejected the request. Please try again later."), {
      status: 502,
    });
  }

  if (!res.ok) {
    console.error("IMB create-order failed:", res.status, rawText);
    throw Object.assign(new Error(data?.message || "Failed to create payment order. Please try again."), {
      status: 502,
    });
  }

  // Confirmed live against IMB: an invalid user_token comes back as HTTP 200
  // with { status: false, message: "..." } rather than a 4xx — logical
  // failures are signalled in the body, not via the HTTP status code.
  const isExplicitFailure = data?.status === false || data?.success === false;

  return { raw: data, paymentUrl: extractPaymentUrl(data), isExplicitFailure };
}

export async function checkImbOrderStatus(orderId) {
  const settings = await getSiteSettings();
  const dbToken = String(settings.imbApiToken || "").trim();
  const envToken = String(process.env.IMB_API_TOKEN || process.env.DEPOSIT_API_TOKEN || "").trim();
  const userToken = dbToken || envToken;

  if (!userToken) {
    throw Object.assign(new Error("Payment service is not configured. Please try again later."), { status: 500 });
  }

  const body = new URLSearchParams({
    user_token: userToken,
    order_id: orderId,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMB_REQUEST_TIMEOUT_MS);

  let res;
  try {
    const fetchOptions = {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    };

    const agent = getProxyAgent();
    if (agent) {
      fetchOptions.agent = agent;
    }

    res = await fetch(IMB_CHECK_STATUS_URL, fetchOptions);
  } catch (err) {
    if (err.name === "AbortError") {
      throw Object.assign(new Error("Payment provider timed out. Please try again."), { status: 504 });
    }
    throw Object.assign(new Error("Unable to reach the payment provider. Please try again."), { status: 503 });
  } finally {
    clearTimeout(timeout);
  }

  const rawText = await res.text();
  try {
    return JSON.parse(rawText);
  } catch {
    throw Object.assign(new Error("Payment provider returned an unexpected response. Please try again."), {
      status: 502,
    });
  }
}

export function isImbStatusSuccess(res) {
  if (!res || typeof res !== "object") return false;

  const extractStatus = (obj) => {
    if (!obj || typeof obj !== "object") return "";
    return String(
      obj.status || obj.Status || obj.order_status || obj.orderStatus || obj.txn_status || obj.txnStatus || obj.state || ""
    ).toUpperCase();
  };

  const mainStatus = extractStatus(res);
  const dataStatus = extractStatus(res.data);
  const resultStatus = extractStatus(res.result);

  const SUCCESS_STRINGS = ["SUCCESS", "PAID", "COMPLETED", "TXN_SUCCESS", "SUCCESSFUL"];

  if (
    SUCCESS_STRINGS.includes(mainStatus) ||
    SUCCESS_STRINGS.includes(dataStatus) ||
    SUCCESS_STRINGS.includes(resultStatus)
  ) {
    return true;
  }

  const isBoolSuccess =
    res.status === true ||
    res.success === true ||
    res.data?.status === true ||
    res.data?.status === 1 ||
    res.data?.status === "1" ||
    res.status === 1 ||
    res.status === "1";

  if (isBoolSuccess) {
    const FAILED_STRINGS = ["FAILED", "REJECTED", "EXPIRED", "CANCELLED", "ERROR", "TXN_FAILURE"];
    if (
      FAILED_STRINGS.includes(mainStatus) ||
      FAILED_STRINGS.includes(dataStatus) ||
      FAILED_STRINGS.includes(resultStatus)
    ) {
      return false;
    }
    return true;
  }

  return false;
}

export function isImbStatusFailed(res) {
  if (!res || typeof res !== "object") return false;

  const extractStatus = (obj) => {
    if (!obj || typeof obj !== "object") return "";
    return String(
      obj.status || obj.Status || obj.order_status || obj.orderStatus || obj.txn_status || obj.txnStatus || obj.state || ""
    ).toUpperCase();
  };

  const mainStatus = extractStatus(res);
  const dataStatus = extractStatus(res.data);
  const resultStatus = extractStatus(res.result);

  const FAILED_STRINGS = ["FAILED", "REJECTED", "EXPIRED", "CANCELLED", "ERROR", "TXN_FAILURE"];

  if (
    FAILED_STRINGS.includes(mainStatus) ||
    FAILED_STRINGS.includes(dataStatus) ||
    FAILED_STRINGS.includes(resultStatus)
  ) {
    return true;
  }

  if (res.status === false || res.success === false) {
    return true;
  }

  return false;
}
