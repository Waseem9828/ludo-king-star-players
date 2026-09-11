import jwt from "jsonwebtoken";

// Verifies a JWT and attaches the decoded payload to req.user.
// Login/token issuance is not implemented yet.
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication token missing" });
  }

  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is missing in environment variables!");
    return res.status(500).json({ message: "Server configuration error" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ message: "Invalid token payload" });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

import User from "../models/User.js";

// Checks if the user's wallet is frozen in the database
export async function requireActiveWallet(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select("walletFrozen status");
    if (!user || user.status === "disabled") {
      return res.status(403).json({ message: "Account disabled" });
    }
    if (user.walletFrozen) {
      return res.status(403).json({ message: "Your wallet is currently frozen by an admin. You cannot perform this action." });
    }
    next();
  } catch (err) {
    return res.status(500).json({ message: "Server error checking wallet status" });
  }
}
