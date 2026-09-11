import { apiRequest } from "./apiClient.js";

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getWallet(token) {
  return apiRequest("/wallet", { headers: authHeader(token) });
}

export function getWalletHistory(token) {
  return apiRequest("/wallet/history", { headers: authHeader(token) });
}

// Add Virtual Coins — a dev/test wallet top-up, not a real payment.
export function addVirtualCoins(token, amount) {
  return apiRequest("/wallet/add", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ amount }),
  });
}

