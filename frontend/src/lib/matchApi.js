import { apiRequest } from "./apiClient.js";

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function listOpenBattles() {
  return apiRequest("/matches/open");
}

export function listRunningBattles() {
  return apiRequest("/matches/running");
}

export function listMyBattles(token) {
  return apiRequest("/matches/mine", { headers: authHeader(token) });
}

export function getMatch(token, id) {
  return apiRequest(`/matches/${id}`, { headers: authHeader(token) });
}

export function createBattle(token, entryCoins) {
  return apiRequest("/matches", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ entryCoins }),
  });
}

export function joinBattle(token, id) {
  return apiRequest(`/matches/${id}/join`, {
    method: "POST",
    headers: authHeader(token),
  });
}

export function cancelBattle(token, id, reason = "") {
  return apiRequest(`/matches/${id}/cancel`, {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ reason }),
  });
}

export function acceptBattle(token, id) {
  return apiRequest(`/matches/${id}/accept`, {
    method: "POST",
    headers: authHeader(token),
  });
}

export function acceptOpponent(token, id) {
  return apiRequest(`/matches/${id}/accept`, {
    method: "POST",
    headers: authHeader(token),
  });
}

export function shareRoomCode(token, id, roomCode) {
  return apiRequest(`/matches/${id}/room-code`, {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ roomCode }),
  });
}

export function submitResultProof(token, id, { imageUrl, claimedResult }) {
  return apiRequest(`/matches/${id}/result-proof`, {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ imageUrl, claimedResult }),
  });
}
