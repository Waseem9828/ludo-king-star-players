import { apiRequest } from "./apiClient.js";

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getReferral(token) {
  return apiRequest("/referral", { headers: authHeader(token) });
}
