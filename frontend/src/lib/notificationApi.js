import { apiRequest } from "./apiClient.js";

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getNotifications(token) {
  return apiRequest("/notifications", { headers: authHeader(token) });
}

export function getUnreadNotificationCount(token) {
  return apiRequest("/notifications/unread-count", { headers: authHeader(token) });
}

export function markNotificationRead(token, id) {
  return apiRequest(`/notifications/${id}/read`, {
    method: "PATCH",
    headers: authHeader(token),
  });
}

export function markAllNotificationsRead(token) {
  return apiRequest("/notifications/read-all", {
    method: "PATCH",
    headers: authHeader(token),
  });
}

export function deleteNotification(token, id) {
  return apiRequest(`/notifications/${id}`, {
    method: "DELETE",
    headers: authHeader(token),
  });
}
