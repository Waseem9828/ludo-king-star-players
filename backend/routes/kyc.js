import { Router } from "express";
import fetch from "node-fetch";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireFields } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { MAX_IMAGE_DATA_URI_LENGTH, isValidImageDataUri } from "../config/uploadConfig.js";
import { getSiteSettings } from "../utils/siteSettings.js";
import { getProxyAgent } from "../utils/proxyAgent.js";
import Kyc from "../models/Kyc.js";

const router = Router();

router.use(requireAuth);

const AADHAAR_REGEX = /^\d{12}$/;

// GET /api/kyc/me — the current user's own KYC status (or null if never
// submitted). Used by the withdrawal flow to decide whether to allow it.
router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const kyc = await Kyc.findOne({ user: req.user.id }).lean();
    if (!kyc) {
      return res.json({ status: "unverified" });
    }
    if (kyc.aadhaarNumber && kyc.aadhaarNumber.length === 12) {
      kyc.aadhaarNumber = `XXXX-XXXX-${kyc.aadhaarNumber.slice(-4)}`;
    }
    res.json(kyc);
  })
);

async function fetchKycApi(url, options) {
  const agent = getProxyAgent();
  if (agent) {
    try {
      const res = await fetch(url, { ...options, agent });
      if (res.status !== 407 && res.status !== 502 && res.status !== 503 && res.status !== 504) {
        return res;
      }
      console.warn(`Fixie proxy returned HTTP ${res.status}. Falling back to direct connection...`);
    } catch (err) {
      console.warn("Proxy connection error. Retrying direct request:", err.message);
    }
  }

  const directOptions = { ...options };
  delete directOptions.agent;
  return await fetch(url, directOptions);
}

// POST /api/kyc/send-otp — Request Aadhaar OTP via IMB Payment API
router.post(
  "/send-otp",
  requireFields("aadhaarNumber"),
  asyncHandler(async (req, res) => {
    const aadhaarNumber = String(req.body.aadhaarNumber).replace(/\s/g, "");

    if (!AADHAAR_REGEX.test(aadhaarNumber)) {
      return res.status(400).json({ message: "Aadhaar number must be exactly 12 digits" });
    }

    const existing = await Kyc.findOne({ user: req.user.id });
    if (existing && existing.status === "verified") {
      return res.status(400).json({ message: "Your KYC is already verified." });
    }

    // Check if Aadhaar is already verified by another user
    const duplicate = await Kyc.findOne({ aadhaarNumber, status: "verified", user: { $ne: req.user.id } });
    if (duplicate) {
      return res.status(400).json({ message: "This Aadhaar number is already linked to another player's account." });
    }

    // Call IMB API to send OTP
    const settings = await getSiteSettings();
    const clientId = settings.kycClientId || process.env.KYC_CLIENT_ID || process.env.IMB_CLIENT_ID;
    const clientSecret = settings.kycClientSecret || process.env.KYC_CLIENT_SECRET || process.env.IMB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ message: "KYC API is not configured." });
    }

    const fetchOptions = {
      method: "POST",
      headers: {
        "x-client-id": clientId,
        "x-client-secret": clientSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ aadhaar_number: aadhaarNumber }),
    };

    let response;
    try {
      response = await fetchKycApi("https://secure.imbpayment.in/api/v1/aadhaar/send-otp", fetchOptions);
    } catch (err) {
      console.error("IMB send-otp connection error:", err.message);
      return res.status(503).json({ message: "Unable to reach the Aadhaar KYC gateway. Please try again." });
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      console.error("IMB send-otp non-JSON response status:", response.status);
      return res.status(502).json({ message: "Aadhaar gateway returned an unexpected response. Please try again." });
    }

    if (data.error_code === "INVALID_IP" || (data.message && data.message.includes("IP is not whitelisted"))) {
      const serverIp = (Array.isArray(data.error) && data.error[0]) || "";
      console.error(`IMB Gateway Error: IP ${serverIp} is not whitelisted on IMB dashboard.`);
      return res.status(403).json({
        message: serverIp 
          ? `Server IP (${serverIp}) is not whitelisted in IMB Merchant Dashboard. Please whitelist ${serverIp} in IMB dashboard.`
          : "Server IP is not whitelisted in IMB Merchant Dashboard."
      });
    }

    const requestId = data.request_id || (data.data && data.data.request_id) || data.client_id || (data.data && data.data.client_id) || data.reference_id || (data.data && data.data.reference_id);

    if (!response.ok || !requestId) {
      console.error("IMB send-otp error:", data);
      return res.status(400).json({ message: data.message || "Failed to send Aadhaar OTP. Please try again." });
    }

    // Return the request_id to the client so they can send it back to verify
    res.json({ request_id: requestId });
  })
);

// POST /api/kyc/verify-otp — Verify Aadhaar OTP via IMB Payment API
router.post(
  "/verify-otp",
  requireFields("aadhaarNumber", "requestId", "otp"),
  asyncHandler(async (req, res) => {
    const aadhaarNumber = String(req.body.aadhaarNumber).replace(/\s/g, "");
    const { requestId, otp } = req.body;

    // Call IMB API to verify OTP
    const settings = await getSiteSettings();
    const clientId = settings.kycClientId || process.env.KYC_CLIENT_ID || process.env.IMB_CLIENT_ID;
    const clientSecret = settings.kycClientSecret || process.env.KYC_CLIENT_SECRET || process.env.IMB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ message: "KYC API is not configured." });
    }

    const fetchOptions = {
      method: "POST",
      headers: {
        "x-client-id": clientId,
        "x-client-secret": clientSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        aadhaar_number: aadhaarNumber,
        request_id: requestId,
        otp: otp,
      }),
    };

    let response;
    try {
      response = await fetchKycApi("https://secure.imbpayment.in/api/v1/aadhaar/verify-otp", fetchOptions);
    } catch (err) {
      console.error("IMB verify-otp connection error:", err.message);
      return res.status(503).json({ message: "Unable to reach the Aadhaar KYC gateway. Please try again." });
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      console.error("IMB verify-otp non-JSON response status:", response.status);
      if (response.status === 407) {
        return res.status(502).json({
          message: "KYC Proxy Authentication Error (HTTP 407). Please update FIXIE_URL or remove it from .env."
        });
      }
      return res.status(502).json({ message: "Aadhaar gateway returned an unexpected response. Please try again." });
    }

    if (data.error_code === "INVALID_IP" || (data.message && data.message.includes("IP is not whitelisted"))) {
      const serverIp = (Array.isArray(data.error) && data.error[0]) || "";
      console.error(`IMB Gateway Error: IP ${serverIp} is not whitelisted on IMB dashboard.`);
      return res.status(403).json({
        message: serverIp 
          ? `Server IP (${serverIp}) is not whitelisted in IMB Merchant Dashboard. Please whitelist ${serverIp} in IMB dashboard.`
          : "Server IP is not whitelisted in IMB Merchant Dashboard."
      });
    }

    if (!response.ok || data.status !== "success") {
      console.error("IMB verify-otp error:", data);
      return res.status(400).json({ message: data.message || "Invalid OTP or verification failed." });
    }

    // Create or update KYC record as verified
    const aadhaarData = data.data?.aadhaar_details || data.data || {};
    const addressObj = aadhaarData.address || aadhaarData.split_address || {};
    
    // Construct full address string if available
    let fullAddress = aadhaarData.address || "";
    if (typeof fullAddress === "object") {
      const parts = [
        addressObj.house,
        addressObj.street,
        addressObj.landmark,
        addressObj.loc || addressObj.vtc,
        addressObj.po,
        addressObj.dist,
        addressObj.state,
        addressObj.country,
        addressObj.pincode || addressObj.zip
      ].filter(Boolean);
      fullAddress = parts.join(", ");
    }

    const name = aadhaarData.name || aadhaarData.full_name || "";
    const dob = aadhaarData.dob || aadhaarData.date_of_birth || "";
    const gender = aadhaarData.gender || "";
    const careOf = aadhaarData.care_of || aadhaarData.father_name || "";
    const pincode = String(aadhaarData.pincode || addressObj.pincode || addressObj.zip || "");
    const state = aadhaarData.state || addressObj.state || "";
    const profileImg = aadhaarData.image_base64 || aadhaarData.profile_image || "";

    let kyc = await Kyc.findOne({ user: req.user.id });
    if (kyc) {
      kyc.aadhaarNumber = aadhaarNumber;
      if (name) kyc.name = name;
      if (dob) kyc.dob = dob;
      if (gender) kyc.gender = gender;
      if (fullAddress) kyc.address = fullAddress;
      if (careOf) kyc.careOf = careOf;
      if (pincode) kyc.pincode = pincode;
      if (state) kyc.state = state;
      if (profileImg) kyc.aadhaarImageUrl = profileImg;
      kyc.status = "verified";
      kyc.reviewedBy = null;
      kyc.reviewedAt = new Date();
      kyc.note = "Auto-verified via Aadhaar Gateway";
      await kyc.save();
    } else {
      kyc = await Kyc.create({
        user: req.user.id,
        aadhaarNumber,
        name,
        dob,
        gender,
        address: fullAddress,
        careOf,
        pincode,
        state,
        aadhaarImageUrl: profileImg,
        status: "verified",
        submittedAt: new Date(),
        reviewedAt: new Date(),
        note: "Auto-verified via Aadhaar Gateway",
      });
    }

    res.json(kyc);
  })
);

export default router;
