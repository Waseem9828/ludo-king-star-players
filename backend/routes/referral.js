import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import User from "../models/User.js";
import Referral from "../models/Referral.js";
import ReferralCommission from "../models/ReferralCommission.js";
import Transaction, { TRANSACTION_TYPE } from "../models/Transaction.js";
import UserContact from "../models/UserContact.js";
import { generateReferralCode } from "../utils/roomCode.js";

const router = Router();

router.use(requireAuth);

async function getOrAssignReferralCode(userId) {
  const user = await User.findById(userId);
  if (user.referralCode) return user.referralCode;

  try {
    user.referralCode = generateReferralCode();
    await user.save();
    return user.referralCode;
  } catch (err) {
    if (err?.code === 11000) {
      const fresh = await User.findById(userId);
      return fresh.referralCode;
    }
    throw err;
  }
}

async function buildReferralPayload(userId) {
  const code = await getOrAssignReferralCode(userId);
  const userObjId = new mongoose.Types.ObjectId(String(userId));

  const [referralsDocs, referredUsers, earningsAgg, commissionsPerFriend] = await Promise.all([
    Referral.find({ referrer: userId }).populate("referredUser", "name createdAt").sort({ createdAt: -1 }),
    User.find({ referredBy: userId }).select("name createdAt").sort({ createdAt: -1 }),
    Transaction.aggregate([
      {
        $match: {
          user: userObjId,
          type: { $in: [TRANSACTION_TYPE.REFERRAL_BONUS, TRANSACTION_TYPE.MATCH_REFERRAL_COMMISSION] },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    ReferralCommission.aggregate([
      { $match: { referrer: userObjId } },
      { $group: { _id: "$referredUser", totalCommission: { $sum: "$commissionAmount" } } },
    ]),
  ]);

  // Build map of commissions per friend
  const commMap = new Map();
  commissionsPerFriend.forEach((c) => {
    if (c._id) commMap.set(c._id.toString(), c.totalCommission);
  });

  const map = new Map();

  referralsDocs.forEach((r) => {
    if (r.referredUser) {
      const friendId = r.referredUser._id.toString();
      const earned = commMap.get(friendId) || r.referrerRewardCoins || 0;
      map.set(friendId, {
        name: r.referredUser.name || "Player",
        rewardCoins: earned,
        joinedAt: r.createdAt,
      });
    }
  });

  referredUsers.forEach((u) => {
    const friendId = u._id.toString();
    if (!map.has(friendId)) {
      const earned = commMap.get(friendId) || 0;
      map.set(friendId, {
        name: u.name || "Player",
        rewardCoins: earned,
        joinedAt: u.createdAt,
      });
    }
  });

  const list = Array.from(map.values()).sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt));

  return {
    code,
    totalReferrals: list.length,
    totalEarned: earningsAgg[0]?.total || 0,
    referrals: list,
  };
}

// GET /api/referral — code, stats and the referral list in one call.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await buildReferralPayload(req.user.id));
  })
);

// GET /api/referral/stats — numeric summary only.
router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const { code, totalReferrals, totalEarned } = await buildReferralPayload(req.user.id);
    res.json({ code, totalReferrals, totalEarned });
  })
);

// POST /api/referral/contacts — Save user device contacts and return unregistered ones
router.post(
  "/contacts",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { contacts } = req.body;
    if (!Array.isArray(contacts)) {
      return res.status(400).json({ message: "Invalid contacts data." });
    }

    const fetchedBy = req.user.id;
    const bulkOps = [];
    const validCleanPhones = [];
    const contactMap = new Map();

    for (const c of contacts) {
      let rawPhone = c.tel?.[0] || "";
      let cleanPhone = rawPhone.replace(/\D/g, "");
      if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);
      if (cleanPhone.length < 10) continue;

      if (!contactMap.has(cleanPhone)) {
        validCleanPhones.push(cleanPhone);
        contactMap.set(cleanPhone, {
          name: c.name?.[0] || "Unknown",
          phone: cleanPhone,
          original: c,
        });
      }
    }

    if (validCleanPhones.length === 0) {
      return res.json({ message: "No valid contacts found.", inserted: 0, unregisteredContacts: [] });
    }

    // 1. Check registered users
    const phonesToCheck = [];
    for (const p of validCleanPhones) {
      phonesToCheck.push(p);
      phonesToCheck.push("91" + p);
      phonesToCheck.push("+91" + p);
    }
    const existingUsers = await User.find({ phone: { $in: phonesToCheck } }, "phone").lean();
    
    // 2. Check contacts already claimed/uploaded by OTHER players
    const alreadyClaimedContacts = await UserContact.find({ 
      phone: { $in: validCleanPhones }, 
      fetchedBy: { $ne: fetchedBy } 
    }, "phone").lean();
    
    // Extract the last 10 digits of existing users' phones for easy lookup
    const excludePhones = new Set();
    
    existingUsers.forEach((u) => {
      let p = u.phone.replace(/\D/g, "");
      excludePhones.add(p.length > 10 ? p.slice(-10) : p);
    });
    
    alreadyClaimedContacts.forEach((c) => {
      let p = c.phone.replace(/\D/g, "");
      excludePhones.add(p.length > 10 ? p.slice(-10) : p);
    });

    const unregisteredContacts = [];

    for (const cleanPhone of validCleanPhones) {
      if (!excludePhones.has(cleanPhone)) {
        const contactData = contactMap.get(cleanPhone);
        unregisteredContacts.push(contactData.original);

        bulkOps.push({
          updateOne: {
            filter: { fetchedBy, phone: cleanPhone },
            update: {
              $setOnInsert: {
                fetchedBy,
                name: contactData.name,
                phone: cleanPhone,
              },
            },
            upsert: true,
          },
        });
      }
    }

    let inserted = 0;
    if (bulkOps.length > 0) {
      const result = await UserContact.bulkWrite(bulkOps, { ordered: false });
      inserted = result.upsertedCount;
    }

    res.json({ 
      message: "Contacts synced successfully", 
      inserted,
      unregisteredContacts 
    });
  })
);

export default router;
