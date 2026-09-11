import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import dns from "node:dns";
try {
  if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder("ipv4first");
  }
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch (e) {}

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

const userSchema = new mongoose.Schema({
  phone: String,
  name: String,
  role: String,
  walletCoins: Number,
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

async function run() {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000, family: 4 });
    console.log("Connected to MongoDB Atlas.");

    const phoneQuery = "9828786246";
    // Find user by matching phone with or without country code
    let user = await User.findOne({
      $or: [
        { phone: phoneQuery },
        { phone: `+91${phoneQuery}` },
        { phone: `91${phoneQuery}` },
      ]
    });

    if (!user) {
      console.log(`User with phone ${phoneQuery} not found. Creating user as Owner...`);
      user = await User.create({
        phone: phoneQuery,
        name: "Platform Owner",
        role: "owner",
      });
      console.log("SUCCESS: Created new user with role 'owner':", user);
    } else {
      user.role = "owner";
      await user.save();
      console.log("SUCCESS: Updated user to role 'owner':", user);
    }
  } catch (err) {
    console.error("ERROR:", err.message);
  } finally {
    await mongoose.disconnect();
  }
}

run();
