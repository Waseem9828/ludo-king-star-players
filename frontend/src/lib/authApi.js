import { apiRequest } from "./apiClient.js";

export function sendUnifiedOtp({ phone, referralCode }) {
  return apiRequest("/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ phone, referralCode }),
  });
}

export function verifyUnifiedOtp({ phone, otp, referralCode, name }) {
  return apiRequest("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ phone, otp, referralCode, name }),
  });
}

export function sendLoginOtp({ phone }) {
  return apiRequest("/auth/login/send-otp", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export function verifyLoginOtp({ phone, otp }) {
  return apiRequest("/auth/login/verify-otp", {
    method: "POST",
    body: JSON.stringify({ phone, otp }),
  });
}

export function sendRegisterOtp({ name, phone, referralCode }) {
  return apiRequest("/auth/register/send-otp", {
    method: "POST",
    body: JSON.stringify({ name, phone, referralCode }),
  });
}

export function verifyRegisterOtp({ phone, otp }) {
  return apiRequest("/auth/register/verify-otp", {
    method: "POST",
    body: JSON.stringify({ phone, otp }),
  });
}

export function fetchCurrentUser(token) {
  return apiRequest("/auth/me", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}
