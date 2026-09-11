import { apiRequest } from "./apiClient.js";

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getAccountStats(token) {
  return apiRequest("/users/me/stats", { headers: authHeader(token) });
}

export function updateProfile(token, { name }) {
  return apiRequest("/users/me", {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify({ name }),
  });
}
