import { apiRequest } from "./apiClient.js";

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getLeaderboard(token) {
  return apiRequest("/leaderboard", { headers: authHeader(token) });
}
