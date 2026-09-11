// Dev-only helper: prints a signed JWT for local testing of role-protected
// routes (e.g. /api/admin/*). Not an HTTP endpoint, not used by the app at
// runtime, and never touches the production auth flow.
//
// Usage:
//   node scripts/generateDevToken.js            -> admin token (default)
//   node scripts/generateDevToken.js owner       -> owner token
//   node scripts/generateDevToken.js user        -> plain user token
import "dotenv/config";
import jwt from "jsonwebtoken";

const secret = process.env.JWT_SECRET;

if (!secret) {
  console.error("JWT_SECRET is not set in backend/.env. Set it before generating a dev token.");
  process.exit(1);
}

const role = process.argv[2] || "admin";
const validRoles = ["user", "admin", "owner"];

if (!validRoles.includes(role)) {
  console.error(`Invalid role "${role}". Expected one of: ${validRoles.join(", ")}`);
  process.exit(1);
}

const payload = {
  id: `dev-${role}-001`,
  name: `${role.charAt(0).toUpperCase()}${role.slice(1)} (Dev)`,
  role,
};

const token = jwt.sign(payload, secret, { expiresIn: "7d" });

console.log(`\nDev-only ${role} JWT (local testing only — do not commit, share, or use in production):\n`);
console.log(token);
console.log(`\nPayload: ${JSON.stringify(payload)} — expires in 7 days.\n`);
