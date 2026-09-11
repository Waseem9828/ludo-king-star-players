import { apiRequest } from "./apiClient.js";

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getMyKyc(token) {
  return apiRequest("/kyc/me", { headers: authHeader(token) });
}

export function sendAadhaarOtp(token, { aadhaarNumber }) {
  return apiRequest("/kyc/send-otp", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ aadhaarNumber }),
  });
}

export function verifyAadhaarOtp(token, { aadhaarNumber, requestId, otp }) {
  return apiRequest("/kyc/verify-otp", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ aadhaarNumber, requestId, otp }),
  });
}
