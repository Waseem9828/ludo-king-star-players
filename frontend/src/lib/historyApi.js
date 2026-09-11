import { apiRequest } from "./apiClient.js";

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getHistory(token, category) {
  const query = category ? `?category=${category}` : "";
  return apiRequest(`/history${query}`, { headers: authHeader(token) });
}

export function getGameHistory(token) {
  return apiRequest("/history/games", { headers: authHeader(token) });
}
