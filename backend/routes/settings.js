import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getSiteSettings } from "../utils/siteSettings.js";
import Notice from "../models/Notice.js";

const router = Router();

// GET /api/settings
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const settings = await getSiteSettings();
    res.json(settings);
  })
);

// GET /api/settings/notices — Public list of active notice bulletins
router.get(
  "/notices",
  asyncHandler(async (req, res) => {
    const notices = await Notice.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
    res.json(notices);
  })
);

export default router;
