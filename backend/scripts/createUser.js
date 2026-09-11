// Dev-only helper: creates or updates a user directly in MongoDB, with any
// role, for local testing. Not an HTTP endpoint — run manually from a
// terminal. The public /api/auth/register endpoint always creates plain
// "user" accounts, so this is the only way to get an admin/owner account
// to log in and test role-based UI/API access for real.
//
// Usage:
//   node scripts/createUser.js "<name>" <phone> <password> [role]
//   role defaults to "user". Valid roles: user, admin, owner.
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";

const [, , name, phone, password, role = "user"] = process.argv;

if (!name || !phone || !password) {
  console.error("Usage: node scripts/createUser.js <name> <phone> <password> [role]");
  process.exit(1);
}

if (!["user", "admin", "owner"].includes(role)) {
  console.error(`Invalid role "${role}". Expected one of: user, admin, owner`);
  process.exit(1);
}

await connectDB();

const passwordHash = await bcrypt.hash(password, 10);
const user = await User.findOneAndUpdate(
  { phone },
  { name, phone, passwordHash, role, status: "active" },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);

console.log(`\nUser ready: ${user.name} (${user.phone}) — role: ${user.role}\n`);

await mongoose.disconnect();
process.exit(0);
