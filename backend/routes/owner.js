import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireOwner } from "../middleware/roleMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import User from "../models/User.js";

const router = Router();

// One-time setup: Claim owner role if no owner exists yet
router.post("/claim", requireAuth, asyncHandler(async (req, res) => {
  const existingOwner = await User.findOne({ role: "owner" });
  if (existingOwner) {
    return res.status(403).json({ message: "An owner already exists for this platform." });
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  user.role = "owner";
  await user.save();
  
  res.json({ message: "Success! You are now the owner. Please log out and log back in to apply the changes." });
}));

// Owner-only endpoints
router.get("/", requireAuth, requireOwner, (req, res) => {
  res.json({ message: "Owner route placeholder" });
});

export default router;
