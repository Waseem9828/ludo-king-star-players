import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'node:dns';

dotenv.config();

try {
  if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder("ipv4first");
  }
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch (e) {}

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

console.log("Testing Connection URI:", uri);

async function run() {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000, family: 4 });
    console.log("Mongoose connected successfully to database!");
  } catch (err) {
    console.log("Error connecting to MongoDB:", err.message);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(console.dir);
