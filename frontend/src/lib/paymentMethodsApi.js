import { apiRequest } from "./apiClient.js";

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Admin-configured "send money here" destinations for deposits.
export function getDepositMethods(token) {
  return apiRequest("/wallet/deposit-methods", { headers: authHeader(token) });
}

// The current user's own saved withdrawal destinations.
export function getPayoutMethods(token) {
  return apiRequest("/wallet/payout-methods", { headers: authHeader(token) });
}

export function addPayoutMethod(token, payload) {
  return apiRequest("/wallet/payout-methods", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify(payload),
  });
}

export function setDefaultPayoutMethod(token, id) {
  return apiRequest(`/wallet/payout-methods/${id}/default`, {
    method: "PATCH",
    headers: authHeader(token),
  });
}

export function deletePayoutMethod(token, id) {
  return apiRequest(`/wallet/payout-methods/${id}`, {
    method: "DELETE",
    headers: authHeader(token),
  });
}
