import { apiRequest } from "./apiClient.js";

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getAdminStats(token) {
  return apiRequest("/admin/stats", { headers: authHeader(token) });
}

export function getUsers(token) {
  return apiRequest("/admin/users", { headers: authHeader(token) });
}

export function getLudoRoomProfile(token) {
  return apiRequest("/admin/ludoroom-profile", { headers: authHeader(token) });
}

export function setUserStatus(token, id, status) {
  return apiRequest(`/admin/users/${id}/status`, {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify({ status }),
  });
}

export function freezeWallet(token, id, walletFrozen) {
  return apiRequest(`/admin/users/${id}/wallet/freeze`, {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify({ walletFrozen }),
  });
}

export function adjustWallet(token, id, { amount, bucket, note }) {
  return apiRequest(`/admin/users/${id}/wallet/adjust`, {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ amount, bucket, note }),
  });
}

export function getMatches(token) {
  return apiRequest("/admin/matches", { headers: authHeader(token) });
}

export function setMatchResult(token, id, winnerId) {
  return apiRequest(`/matches/${id}/result`, {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify({ winnerId }),
  });
}

export function resolveMatch(token, id, resolutionParams) {
  return apiRequest(`/admin/matches/${id}/resolve`, {
    method: "POST",
    headers: { ...authHeader(token), "Content-Type": "application/json" },
    body: JSON.stringify(resolutionParams),
  });
}

export function checkLudoRoomResult(token, id) {
  return apiRequest(`/admin/matches/${id}/check-result`, {
    method: "POST",
    headers: authHeader(token),
  });
}

export function resolveMatchAdmin(token, id, action) {
  return apiRequest(`/admin/matches/${id}/resolve`, {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify({ action }),
  });
}

export function getWithdrawals(token) {
  return apiRequest("/admin/withdrawals", { headers: authHeader(token) });
}

export function updateWithdrawal(token, id, action) {
  return apiRequest(`/admin/withdrawals/${id}`, {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify({ action }),
  });
}

export function getDepositHistory(token) {
  return apiRequest("/admin/deposit-history", { headers: authHeader(token) });
}

export function refreshDepositOrder(token, id) {
  return apiRequest(`/admin/deposit-history/${id}/refresh`, {
    method: "POST",
    headers: authHeader(token),
  });
}

export function getSupportTickets(token) {
  return apiRequest("/admin/support-tickets", { headers: authHeader(token) });
}

export function getSupportTicket(token, id) {
  return apiRequest(`/admin/support-tickets/${id}`, { headers: authHeader(token) });
}

export function updateSupportTicketStatus(token, id, status) {
  return apiRequest(`/admin/support-tickets/${id}`, {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify({ status }),
  });
}

export function addMember(token, { name, phone, password, role }) {
  return apiRequest("/admin/users", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ name, phone, password, role }),
  });
}

export function getAdminBanners(token) {
  return apiRequest("/admin/banners", { headers: authHeader(token) });
}

export function createBanner(token, { title, imageUrl, linkUrl, order }) {
  return apiRequest("/admin/banners", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ title, imageUrl, linkUrl, order }),
  });
}

export function updateBanner(token, id, updates) {
  return apiRequest(`/admin/banners/${id}`, {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify(updates),
  });
}

export function deleteBanner(token, id) {
  return apiRequest(`/admin/banners/${id}`, {
    method: "DELETE",
    headers: authHeader(token),
  });
}

export function getAdminDepositMethods(token) {
  return apiRequest("/admin/deposit-methods", { headers: authHeader(token) });
}

export function createDepositMethod(token, payload) {
  return apiRequest("/admin/deposit-methods", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify(payload),
  });
}

export function updateDepositMethod(token, id, updates) {
  return apiRequest(`/admin/deposit-methods/${id}`, {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify(updates),
  });
}

export function deleteDepositMethod(token, id) {
  return apiRequest(`/admin/deposit-methods/${id}`, {
    method: "DELETE",
    headers: authHeader(token),
  });
}

export function broadcastNotification(token, { title, message }) {
  return apiRequest("/admin/notifications/broadcast", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ title, message }),
  });
}

export function getBroadcasts(token) {
  return apiRequest("/admin/notifications/broadcasts", {
    headers: authHeader(token),
  });
}

export function deleteBroadcast(token, title) {
  return apiRequest(`/admin/notifications/broadcasts?title=${encodeURIComponent(title)}`, {
    method: "DELETE",
    headers: authHeader(token),
  });
}

export function runAdvancedStorageCleanup(token, { category, timeRangeDays }) {
  return apiRequest("/admin/storage/cleanup", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ category, timeRangeDays }),
  });
}

export function getReferralSettings(token) {
  return apiRequest("/admin/referral-settings", { headers: authHeader(token) });
}

export function updateReferralSettings(token, payload) {
  return apiRequest("/admin/referral-settings", {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify(payload),
  });
}

export async function getAdminSiteSettings(token) {
  return apiRequest("/admin/site-settings", { headers: authHeader(token) });
}

export async function updateAdminSiteSettings(token, payload) {
  return apiRequest("/admin/site-settings", {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify(payload),
  });
}

export function getAdminKyc(token) {
  return apiRequest("/admin/kyc", { headers: authHeader(token) });
}

export function processKyc(token, id, action, note) {
  return apiRequest(`/admin/kyc/${id}`, {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify({ action, note }),
  });
}

export function manualVerifyUserKyc(token, userId, payload = {}) {
  return apiRequest(`/admin/users/${userId}/kyc/verify`, {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify(payload),
  });
}

// Storage Management & Deletion APIs
export function getStorageStats(token) {
  return apiRequest("/admin/storage/stats", { headers: authHeader(token) });
}

export function getMatchProofImages(token, id) {
  return apiRequest(`/admin/matches/${id}/proof`, { headers: authHeader(token) });
}

export function clearMatchProofImages(token, id) {
  return apiRequest(`/admin/matches/${id}/proof-images`, {
    method: "DELETE",
    headers: authHeader(token),
  });
}

export function deleteMatchAdmin(token, id) {
  return apiRequest(`/admin/matches/${id}`, {
    method: "DELETE",
    headers: authHeader(token),
  });
}

export function cleanupAllMatchImages(token) {
  return apiRequest("/admin/storage/cleanup-match-images", {
    method: "POST",
    headers: authHeader(token),
  });
}

export function purgeOldData(token, days = 20) {
  return apiRequest(`/admin/maintenance/purge?days=${days}`, {
    method: "DELETE",
    headers: authHeader(token),
  });
}

export function clearKycImage(token, id) {
  return apiRequest(`/admin/kyc/${id}/image`, {
    method: "DELETE",
    headers: authHeader(token),
  });
}

export function cleanupAllKycImages(token) {
  return apiRequest("/admin/storage/cleanup-kyc-images", {
    method: "POST",
    headers: authHeader(token),
  });
}

export function deleteDepositOrder(token, id) {
  return apiRequest(`/admin/deposit-history/${id}`, {
    method: "DELETE",
    headers: authHeader(token),
  });
}

export function cleanupDeposits(token) {
  return apiRequest("/admin/storage/cleanup-deposits", {
    method: "POST",
    headers: authHeader(token),
  });
}

export function deleteWithdrawalAdmin(token, id) {
  return apiRequest(`/admin/withdrawals/${id}`, {
    method: "DELETE",
    headers: authHeader(token),
  });
}

export function cleanupWithdrawals(token) {
  return apiRequest("/admin/storage/cleanup-withdrawals", {
    method: "POST",
    headers: authHeader(token),
  });
}

export function getSystemHealth(token) {
  return apiRequest("/admin/system-health", {
    headers: authHeader(token),
  });
}

export function getServerIp(token) {
  return apiRequest("/admin/server-ip", {
    headers: authHeader(token),
  });
}

export function getUserDetail(token, id) {
  return apiRequest(`/admin/users/${id}`, {
    headers: authHeader(token),
  });
}

export function updateUserPassword(token, id, newPassword) {
  return apiRequest(`/admin/users/${id}/password`, {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify({ newPassword }),
  });
}

export function updateUserRole(token, id, role) {
  return apiRequest(`/admin/users/${id}/role`, {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify({ role }),
  });
}

export function getAdminNotices(token) {
  return apiRequest("/admin/notices", {
    headers: authHeader(token),
  });
}

export function createNotice(token, payload) {
  return apiRequest("/admin/notices", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify(payload),
  });
}

export function updateNotice(token, id, payload) {
  return apiRequest(`/admin/notices/${id}`, {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify(payload),
  });
}

export function deleteNotice(token, id) {
  return apiRequest(`/admin/notices/${id}`, {
    method: "DELETE",
    headers: authHeader(token),
  });
}

export function getAdminLogs(token, page = 1, limit = 50, adminId = "") {
  let url = `/admin/logs?page=${page}&limit=${limit}`;
  if (adminId) url += `&adminId=${adminId}`;
  return apiRequest(url, { headers: authHeader(token) });
}

export function getAdminLogsStats(token) {
  return apiRequest("/admin/logs/stats", { headers: authHeader(token) });
}
