import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireFields } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import SupportTicket from "../models/SupportTicket.js";

const router = Router();

router.use(requireAuth);

// GET /api/support — current user's own tickets, newest first.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const tickets = await SupportTicket.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(tickets);
  })
);

// POST /api/support — create a new ticket for the current user.
router.post(
  "/",
  requireFields("subject", "message"),
  asyncHandler(async (req, res) => {
    const subject = String(req.body.subject).trim();
    const message = String(req.body.message).trim();

    if (!subject || !message) {
      return res.status(400).json({ message: "Subject and message cannot be empty." });
    }

    const ticket = await SupportTicket.create({ user: req.user.id, subject, message });
    res.status(201).json(ticket);
  })
);

export default router;
