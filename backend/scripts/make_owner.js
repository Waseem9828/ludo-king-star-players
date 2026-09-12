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
    if (!uri) {
      console.error("ERROR: MONGO_URI is missing in environment.");
      return;
    }
    await mongoose.connect(uri);
    console.log("Connected to MongoDB Atlas.");

    const ownerPhones = ["9828786246", "9671818861", "8930237313"];

    for (const rawPhone of ownerPhones) {
      const cleanPhone = String(rawPhone).replace(/\D/g, "").slice(-10);
      let user = await User.findOne({
        $or: [
          { phone: cleanPhone },
          { phone: `+91${cleanPhone}` },
          { phone: `91${cleanPhone}` },
        ]
      });

      if (!user) {
        user = await User.create({
          phone: cleanPhone,
          name: `Owner_${cleanPhone.slice(-4)}`,
          role: "owner",
        });
        console.log(`SUCCESS: Created new user with phone ${cleanPhone} as 'owner'.`);
      } else {
        user.role = "owner";
        await user.save();
        console.log(`SUCCESS: Updated existing user ${cleanPhone} (${user.name}) to role 'owner'.`);
      }
    }
  } catch (err) {
    console.error("ERROR:", err.message);
  } finally {
    await mongoose.disconnect();
  }
}

run();

