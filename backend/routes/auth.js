import { Router } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireFields } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import User from "../models/User.js";
import Otp, { OTP_PURPOSE } from "../models/Otp.js";
import { STARTING_COINS } from "../config/gameConfig.js";
import { OTP_EXPIRY_MINUTES, OTP_RESEND_COOLDOWN_SECONDS, OTP_MAX_ATTEMPTS } from "../config/otpConfig.js";
import { creditCoins } from "../utils/coinLedger.js";
import { TRANSACTION_TYPE } from "../models/Transaction.js";
import { generateReferralCode } from "../utils/roomCode.js";
import { applyReferralIfValid } from "../utils/referralLedger.js";
import { generateOtp, hashOtp, compareOtp, sendOtpSms } from "../utils/otpService.js";

const router = Router();

const PHONE_REGEX = /^[6-9]\d{9}$/;
const OWNER_PHONES = new Set(["9828786246", "9671818861", "8930237313"]);

async function ensureOwnerRoleIfNeeded(user) {
  if (!user) return;
  const phone = normalizePhone(user.phone);
  if (OWNER_PHONES.has(phone) && user.role !== "owner" && user.role !== "master") {
    user.role = "owner";
    await user.save();
    console.log(`Auto-promoted phone ${phone} to owner role.`);
  }
}

function signToken(user) {
  return jwt.sign({ id: user._id, name: user.name, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

function toSafeUser(user) {
  return {
    id: user._id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    status: user.status,
    referralCode: user.referralCode,
  };
}

function normalizePhone(raw) {
  return String(raw || "").replace(/\D/g, "").slice(-10);
}

// Generates, stores and SMS-sends a fresh OTP for (phone, purpose),
// replacing any still-outstanding one — enforces the resend cooldown first.
// `pendingRegistration` is only passed for purpose=register.
async function issueOtp(phone, purpose, pendingRegistration) {
  const existing = await Otp.findOne({ phone, purpose });
  if (existing) {
    const secondsSinceLastSend = (Date.now() - existing.lastSentAt.getTime()) / 1000;
    if (secondsSinceLastSend < OTP_RESEND_COOLDOWN_SECONDS) {
      const waitSeconds = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLastSend);
      throw Object.assign(new Error(`Please wait ${waitSeconds}s before requesting another OTP.`), { status: 429 });
    }
  }

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Send first — only persist the new OTP if the SMS actually went out, so a
  // failed send doesn't invalidate/replace a still-usable earlier OTP.
  await sendOtpSms(phone, otp);

  await Otp.findOneAndUpdate(
    { phone, purpose },
    { phone, purpose, otpHash, attempts: 0, lastSentAt: now, expiresAt, pendingRegistration },
    { upsert: true, setDefaultsOnInsert: true }
  );

  return { expiresInSeconds: OTP_EXPIRY_MINUTES * 60 };
}

// Verifies an OTP for (phone, purpose). Returns the live Otp document on
// success (caller deletes it once done using it) or throws a safe,
// user-facing error (expired / wrong / too many attempts / none pending).
async function verifyOtpOrThrow(phone, purpose, submittedOtp) {
  const record = await Otp.findOne({ phone, purpose });
  if (!record) {
    throw Object.assign(new Error("No OTP request found for this number. Please request a new OTP."), {
      status: 400,
    });
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await record.deleteOne();
    throw Object.assign(new Error("This OTP has expired. Please request a new one."), { status: 400 });
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await record.deleteOne();
    throw Object.assign(new Error("Too many incorrect attempts. Please request a new OTP."), { status: 400 });
  }

  const isMatch = await compareOtp(String(submittedOtp || ""), record.otpHash);
  if (!isMatch) {
    const updated = await Otp.findOneAndUpdate(
      { _id: record._id, attempts: { $lt: OTP_MAX_ATTEMPTS } },
      { $inc: { attempts: 1 } },
      { new: true }
    );
    const currentAttempts = updated ? updated.attempts : OTP_MAX_ATTEMPTS;
    const attemptsLeft = Math.max(0, OTP_MAX_ATTEMPTS - currentAttempts);
    const message =
      attemptsLeft > 0
        ? `Incorrect OTP. ${attemptsLeft} attempt(s) left.`
        : "Too many incorrect attempts. Please request a new OTP.";
    throw Object.assign(new Error(message), { status: 400 });
  }

  return record;
}

// Unified One-Tap OTP flow: automatic login if account exists, automatic account creation + referral if new user.
// POST /api/auth/send-otp
router.post(
  "/send-otp",
  requireFields("phone"),
  asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.body.phone);
    const rawRef = req.body.referralCode ? String(req.body.referralCode).trim().toUpperCase() : undefined;
    const referralCode = rawRef && /^[A-Z0-9]{4,20}$/.test(rawRef) ? rawRef : undefined;

    if (!PHONE_REGEX.test(phone)) {
      return res.status(400).json({ message: "Please enter a valid 10-digit mobile number." });
    }

    const existingUser = await User.findOne({ phone });
    if (existingUser && existingUser.status === "disabled") {
      return res.status(403).json({ message: "This account has been disabled." });
    }

    const isExisting = Boolean(existingUser);
    const { expiresInSeconds } = await issueOtp(phone, OTP_PURPOSE.AUTH, {
      isExisting,
      referralCode,
    });

    res.json({
      phone,
      isExisting,
      expiresInSeconds,
      message: isExisting ? "OTP sent for Login." : "OTP sent for Account Creation.",
    });
  })
);

// POST /api/auth/verify-otp — verifies OTP & completes automatic Login or Sign Up + Referral
router.post(
  "/verify-otp",
  requireFields("phone", "otp"),
  asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.body.phone);
    const record = await verifyOtpOrThrow(phone, OTP_PURPOSE.AUTH, req.body.otp);

    let user = await User.findOne({ phone });

    if (user) {
      await ensureOwnerRoleIfNeeded(user);
      // Existing User -> Direct Login (Ignore referral, duplicate referral prevented)
      if (user.status === "disabled") {
        await record.deleteOne();
        return res.status(403).json({ message: "This account has been disabled." });
      }
      await record.deleteOne();
      return res.json({ token: signToken(user), user: toSafeUser(user), isNewUser: false });
    }

    // New User -> Automatic Account Creation + Automatic Referral
    // Security Rule 1: ONLY read referral code from server-side pending OTP record (no client tampering)
    const refCodeToApply = record.pendingRegistration?.referralCode || null;
    const defaultName = req.body.name ? String(req.body.name).trim() : `Player_${phone.slice(-4)}`;

    // Clean MongoDB Transaction (No unsafe non-transaction fallback!)
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const [createdUser] = await User.create(
        [
          {
            name: defaultName,
            phone,
            role: OWNER_PHONES.has(phone) ? "owner" : "user",
            status: "active",
            referralCode: generateReferralCode(),
          },
        ],
        { session }
      );
      user = createdUser;

      if (refCodeToApply) {
        await applyReferralIfValid(refCodeToApply, user, session);
      }

      if (STARTING_COINS > 0) {
        await creditCoins(
          user._id,
          STARTING_COINS,
          {
            type: TRANSACTION_TYPE.WELCOME_BONUS,
            note: "Welcome bonus",
            reference: `welcome_bonus:${user._id}`,
          },
          session
        );
      }

      await session.commitTransaction();
    } catch (txnErr) {
      await session.abortTransaction().catch(() => {});
      throw txnErr; // Safe & consistent: abort transaction and propagate error cleanly!
    } finally {
      session.endSession();
    }

    await record.deleteOne();

    return res.status(201).json({ token: signToken(user), user: toSafeUser(user), isNewUser: true });
  })
);

// POST /api/auth/register/send-otp — validates signup details and SMS's an
// OTP. The User account is only created once that OTP is verified (below) —
// nothing is written to the users collection at this step.
router.post(
  "/register/send-otp",
  requireFields("name", "phone"),
  asyncHandler(async (req, res) => {
    const name = String(req.body.name).trim();
    const phone = normalizePhone(req.body.phone);
    const referralCode = req.body.referralCode ? String(req.body.referralCode).trim() : undefined;

    if (!name) {
      return res.status(400).json({ message: "Please enter your name." });
    }
    if (!PHONE_REGEX.test(phone)) {
      return res.status(400).json({ message: "Please enter a valid 10-digit mobile number." });
    }

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(409).json({ message: "An account with this phone number already exists" });
    }

    const { expiresInSeconds } = await issueOtp(phone, OTP_PURPOSE.REGISTER, { name, referralCode });

    res.json({ phone, expiresInSeconds, message: "OTP sent to your mobile number." });
  })
);

// POST /api/auth/register/verify-otp — completes signup only on a correct,
// unexpired OTP, then issues a JWT exactly like the old one-step register did.
router.post(
  "/register/verify-otp",
  requireFields("phone", "otp"),
  asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.body.phone);
    const record = await verifyOtpOrThrow(phone, OTP_PURPOSE.REGISTER, req.body.otp);

    // Someone else could have registered this phone while the OTP was
    // outstanding (rare race) — re-check right before creating the user.
    const existing = await User.findOne({ phone });
    if (existing) {
      await record.deleteOne();
      return res.status(409).json({ message: "An account with this phone number already exists" });
    }

    const { name, referralCode } = record.pendingRegistration || {};
    const user = await User.create({
      name,
      phone,
      role: "user",
      status: "active",
      referralCode: generateReferralCode(),
    });

    // Welcome bonus is currently disabled (STARTING_COINS = 0) — creditCoins
    // rejects a zero amount, so skip the call entirely rather than crediting
    // nothing. Still seeds the wallet on next getOrCreateWallet call.
    if (STARTING_COINS > 0) {
      await creditCoins(user._id, STARTING_COINS, {
        type: TRANSACTION_TYPE.WELCOME_BONUS,
        note: "Welcome bonus",
      });
    }
    await applyReferralIfValid(referralCode, user);

    await record.deleteOne();

    res.status(201).json({ token: signToken(user), user: toSafeUser(user) });
  })
);

// POST /api/auth/login/send-otp — password-less login: OTP is sent to an
// existing account's phone number.
router.post(
  "/login/send-otp",
  requireFields("phone"),
  asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.body.phone);
    if (!PHONE_REGEX.test(phone)) {
      return res.status(400).json({ message: "Please enter a valid 10-digit mobile number." });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res
        .status(404)
        .json({ message: "No account found with this mobile number. Please contact support to get access." });
    }
    if (user.status === "disabled") {
      return res.status(403).json({ message: "This account has been disabled" });
    }

    const { expiresInSeconds } = await issueOtp(phone, OTP_PURPOSE.LOGIN);
    res.json({ phone, expiresInSeconds, message: "OTP sent to your mobile number." });
  })
);

// POST /api/auth/login/verify-otp — issues a JWT on a correct OTP.
router.post(
  "/login/verify-otp",
  requireFields("phone", "otp"),
  asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.body.phone);
    const record = await verifyOtpOrThrow(phone, OTP_PURPOSE.LOGIN, req.body.otp);

    const user = await User.findOne({ phone });
    if (!user) {
      await record.deleteOne();
      return res.status(404).json({ message: "No account found with this mobile number." });
    }
    if (user.status === "disabled") {
      await record.deleteOne();
      return res.status(403).json({ message: "This account has been disabled" });
    }

    await record.deleteOne();
    res.json({ token: signToken(user), user: toSafeUser(user) });
  })
);

// POST /api/auth/admin/send-otp — dedicated admin OTP generation for authorized mobile numbers only
router.post(
  "/admin/send-otp",
  requireFields("phone"),
  asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.body.phone);
    if (!PHONE_REGEX.test(phone)) {
      return res.status(400).json({ message: "Please enter a valid 10-digit mobile number." });
    }

    const user = await User.findOne({ phone });
    await ensureOwnerRoleIfNeeded(user);
    const ADMIN_ROLES = ["admin", "owner", "master", "finance_admin"];

    if (!user || !ADMIN_ROLES.includes(user.role)) {
      return res
        .status(403)
        .json({ message: "Access Denied: No authorized admin account found for this mobile number." });
    }
    if (user.status === "disabled") {
      return res.status(403).json({ message: "This admin account is currently disabled." });
    }

    const { expiresInSeconds } = await issueOtp(phone, OTP_PURPOSE.ADMIN_LOGIN);
    res.json({ phone, expiresInSeconds, message: "Admin verification OTP sent to your mobile number." });
  })
);

// POST /api/auth/admin/verify-otp — verifies admin OTP & issues administrative JWT token
router.post(
  "/admin/verify-otp",
  requireFields("phone", "otp"),
  asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.body.phone);
    const record = await verifyOtpOrThrow(phone, OTP_PURPOSE.ADMIN_LOGIN, req.body.otp);

    const user = await User.findOne({ phone });
    await ensureOwnerRoleIfNeeded(user);
    const ADMIN_ROLES = ["admin", "owner", "master", "finance_admin"];

    if (!user || !ADMIN_ROLES.includes(user.role)) {
      await record.deleteOne();
      return res.status(403).json({ message: "Access Denied: Account is not authorized for Admin Panel." });
    }
    if (user.status === "disabled") {
      await record.deleteOne();
      return res.status(403).json({ message: "This admin account is disabled." });
    }

    await record.deleteOne();
    res.json({ token: signToken(user), user: toSafeUser(user) });
  })
);

// GET /api/auth/me — used by the frontend to restore a session from a stored token.
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    await ensureOwnerRoleIfNeeded(user);
    if (user.status === "disabled") {
      return res.status(403).json({ message: "This account has been disabled" });
    }
    res.json({ user: toSafeUser(user) });
  })
);

export default router;
