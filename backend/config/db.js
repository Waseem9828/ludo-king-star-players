import mongoose from "mongoose";
import dns from "node:dns";

// Fast public DNS fallback for local development (skip on Vercel Serverless)
if (!process.env.VERCEL) {
  try {
    if (dns.setDefaultResultOrder) {
      dns.setDefaultResultOrder("ipv4first");
    }
    dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
  } catch (e) {
    // Ignore if unsupported in local environment
  }
}

// Enable Mongoose query buffering so cold-start queries wait for connection instead of throwing
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
    console.warn("MONGO_URI is not set. Skipping database connection.");
    return null;
  }

  const isServerless = Boolean(process.env.VERCEL);

  const options = {
    serverSelectionTimeoutMS: 15000, // 15-second timeout to allow Atlas TLS handshake & DNS resolution on cold starts
    connectTimeoutMS: 15000,          // 15-second connection timeout
    socketTimeoutMS: 45000,          // 45s socket timeout to release dead sockets cleanly
    maxPoolSize: isServerless ? 15 : 50, // Connection pool limit
    minPoolSize: isServerless ? 0 : 2,    // Maintain small pool on dedicated servers, 0 on lambdas
    maxIdleTimeMS: 120000,          // 2 minutes max idle before recycling socket
    heartbeatFrequencyMS: 10000,    // Ping every 10 seconds to detect network drops fast
    retryWrites: true,
    retryReads: true,
  };

  if (!cached.promise) {
    cached.promise = (async () => {
      let retries = 3;
      while (retries > 0) {
        try {
          const conn = await mongoose.connect(uri, options);
          return conn;
        } catch (err) {
          retries -= 1;
          console.error(`MongoDB connection attempt failed (${retries} retries left):`, err.message);
          if (retries === 0) {
            cached.promise = null;
            throw err;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    })();
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


