import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import Notification from "../models/Notification.js";

const router = Router();

// Every route below only ever reads/writes req.user.id's own notifications —
// there is no :userId param, so a user can never read or modify anyone
// else's notifications.
router.use(requireAuth);

// GET /api/notifications — the current user's notifications, newest first.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json(notifications);
  })
);

// GET /api/notifications/unread-count
router.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    const count = await Notification.countDocuments({ user: req.user.id, isRead: false });
    res.json({ count });
  })
);

// PATCH /api/notifications/:id/read
router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: { isRead: true } },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.json(notification);
  })
);

// PATCH /api/notifications/read-all
router.patch(
  "/read-all",
  asyncHandler(async (req, res) => {
    await Notification.updateMany({ user: req.user.id, isRead: false }, { $set: { isRead: true } });
    res.json({ message: "All notifications marked as read" });
  })
);

// DELETE /api/notifications/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.json({ message: "Notification deleted" });
  })
);

export default router;
