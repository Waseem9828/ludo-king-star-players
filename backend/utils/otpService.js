import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import dns from "node:dns";

// Ensure fast public DNS resolution for SMS gateway endpoints (bypasses ISP DNS issues locally)
if (!process.env.VERCEL) {
  try {
    if (dns.setDefaultResultOrder) {
      dns.setDefaultResultOrder("ipv4first");
    }
    dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
  } catch (e) {
    // Ignore if environment forbids setting custom DNS servers
  }
}

// API-King OTP Send endpoint — exact URL, request body shape ({ number, otp,
// route }) and auth (Authorization: <key>, no "Bearer" prefix) per their docs.
const API_KING_SEND_URL = "https://api.api-king.com/api/v1/otp/send";

// Cryptographically-secure 6-digit code (crypto.randomInt, not Math.random).
export function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

export function hashOtp(otp) {
  return bcrypt.hash(otp, 10);
}

export function compareOtp(otp, otpHash) {
  return bcrypt.compare(otp, otpHash);
}

// Sends the OTP via API-King. Throws a safe, user-facing Error (with
// .status) on any failure — callers should let asyncHandler/errorHandler
// turn that into the HTTP response; the raw provider response/API key are
// never exposed to the client, only logged server-side.
export async function sendOtpSms(phone, otp) {
  const apiKey = process.env.API_KING_KEY;
  if (!apiKey) {
    console.warn(`[DEV WARNING] API_KING_KEY not set. OTP for ${phone}: ${otp}`);
    throw Object.assign(new Error("SMS service is not configured. Please try again later."), { status: 500 });
  }

  console.log(`[OTP SERVICE] Sending SMS to ${phone} with code: ${otp}`);

  let res;
  try {
    res = await fetch(API_KING_SEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({ number: phone, otp, route: "sms" }),
      signal: AbortSignal.timeout(12000), // 12-second max timeout
    });
  } catch (err) {
    console.error("API-King request failed:", err.message);
    throw Object.assign(new Error("Unable to reach the SMS provider. Please try again."), { status: 503 });
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      // ignore — nothing useful to read
    }
    console.error("API-King OTP send failed:", res.status, detail);
    throw Object.assign(new Error("Failed to send OTP. Please try again."), { status: 502 });
  }

  const resJson = await res.json().catch(() => ({}));
  console.log(`[SMS SUCCESS] Sent OTP to ${phone}:`, resJson);
}
