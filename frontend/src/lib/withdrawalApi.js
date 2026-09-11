import { apiRequest } from "./apiClient.js";

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function requestWithdrawal(token, payload) {
  return apiRequest("/withdrawals", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify(payload),
  });
}

export function getWithdrawals(token) {
  return apiRequest("/withdrawals", { headers: authHeader(token) });
}
