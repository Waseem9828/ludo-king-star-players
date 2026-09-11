import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import Banner from "../models/Banner.js";

const router = Router();

// GET /api/banners — public, active banners only, ordered for display.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const banners = await Banner.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
    res.json(banners);
  })
);

export default router;
