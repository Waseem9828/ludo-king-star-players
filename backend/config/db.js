import mongoose from "mongoose";
import dns from "node:dns";

// Guard DNS adjustments for non-Vercel environments to avoid interfering with AWS Lambda SRV resolution
if (!process.env.VERCEL) {
  try {
    if (dns.setDefaultResultOrder) {
      dns.setDefaultResultOrder("ipv4first");
    }
    dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
  } catch (e) {
    // Ignore if unsupported in environment
  }
}

// Enable Mongoose query buffering so cold-start queries wait for connection
mongoose.set("bufferCommands", true);

// Global connection cache across hot lambdas / module re-evaluations
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

mongoose.connection.on("connected", () => {
  console.log("MongoDB connection established successfully.");
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected. Clearing connection cache for auto-reconnect...");
  cached.conn = null;
  cached.promise = null;
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err.message);
});

export async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (cached.conn && cached.conn.readyState === 1) {
    return cached.conn;
  }

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    const errorMsg = "MONGO_URI is missing in Vercel Environment Variables. Please set MONGO_URI in Vercel Project Settings.";
    console.error(`⚠️  ${errorMsg}`);
    const err = new Error(errorMsg);
    err.name = "MongoServerSelectionError";
    throw err;
  }

  if (!cached.promise) {
    const isServerless = Boolean(process.env.VERCEL);
    const options = {
      serverSelectionTimeoutMS: isServerless ? 10000 : 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      maxPoolSize: isServerless ? 10 : 50,
      minPoolSize: 0,
      maxIdleTimeMS: 120000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      retryReads: true,
    };

    cached.promise = mongoose.connect(uri, options).then((m) => {
      console.log("MongoDB connection established successfully.");
      return m;
    }).catch((err) => {
      cached.promise = null;
      cached.conn = null;
      console.error("MongoDB connection failed:", err.message);
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    cached.conn = null;
    throw err;
  }
}




