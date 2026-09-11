import { apiRequest } from "./apiClient.js";

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getMyTickets(token) {
  return apiRequest("/support", { headers: authHeader(token) });
}

export function createTicket(token, { subject, message }) {
  return apiRequest("/support", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ subject, message }),
  });
}
