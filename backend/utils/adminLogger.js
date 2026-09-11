import AdminLog from "../models/AdminLog.js";

/**
 * Log an admin action to the database.
 * 
 * @param {Object} req - The Express request object (used to extract admin user and IP).
 * @param {String} action - A short uppercase string describing the action (e.g. "ADJUST_WALLET").
 * @param {String} details - A human-readable description of what happened.
 * @param {ObjectId} targetUserId - (Optional) The ID of the user affected by the action.
 */
export async function logAdminAction(req, action, details, targetUserId = null) {
  try {
    const adminId = req.user ? req.user.id || req.user._id : null;
    if (!adminId) return;

    // Use x-forwarded-for if behind a proxy, else fallback to req.ip
    const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || "unknown";

    await AdminLog.create({
      adminId,
      action,
      details,
      targetUser: targetUserId,
      ipAddress,
    });
  } catch (error) {
    console.error("Failed to log admin action:", error);
  }
}
