import Notification from "../models/Notification.js";
import User from "../models/User.js";

// Fire-and-record a single-user notification. Never throws into the
// caller's main flow — a notification failing to save should never roll
// back or block the wallet/match action that triggered it.
export async function notifyUser(userId, { type, title, message = "", match = null }) {
  try {
    await Notification.create({ user: userId, type, title, message, match });
  } catch (err) {
    console.error("Failed to create notification:", err.message);
  }
}

// Broadcasts one notification row per active user — used for admin
// announcements. Runs as a single bulk insert so it stays fast even with
// a large user base.
export async function notifyAllUsers({ type, title, message = "" }) {
  const users = await User.find({ status: "active" }).select("_id");
  if (users.length === 0) return 0;

  try {
    await Notification.insertMany(
      users.map((u) => ({ user: u._id, type, title, message })),
      { ordered: false }
    );
  } catch (err) {
    console.error("Failed to broadcast notification:", err.message);
  }

  return users.length;
}
