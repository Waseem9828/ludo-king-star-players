import mongoose from "mongoose";
import dns from "node:dns";

// Pre-set public DNS servers locally to fix SRV lookup delays on Jio/local ISPs (Skip in Vercel Serverless)
try {
  if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder("ipv4first");
  }
  if (!process.env.VERCEL) {
    dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
  }
} catch (e) {
  // Ignore if unsupported in environment
}

let isConnecting = false;

// Enable Mongoose query buffering so queries wait for connection on cold start instead of immediately throwing
mongoose.set("bufferCommands", true);

mongoose.connection.on("connected", () => {
  console.log("MongoDB connected successfully.");
  isConnecting = false;
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected. Attempting fast background reconnect...");
  if (!isConnecting && mongoose.connection.readyState === 0) {
    isConnecting = true;
    setTimeout(() => {
      connectDB().catch((err) => {
        console.error("Background reconnect failed:", err.message);
        isConnecting = false;
      });
    }, 500);
  }
});

mongoose.connection.on("error", (err) => console.error("MongoDB connection error:", err.message));

export async function connectDB() {
  if (mongoose.connection.readyState === 1) return;

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!uri) {
    console.warn("MONGO_URI is not set. Skipping database connection.");
    return;
  }

  const isServerless = Boolean(process.env.VERCEL);

  const options = {
    serverSelectionTimeoutMS: 5000,  // Fast 5-second timeout for server selection (prevents 30s hanging requests)
    connectTimeoutMS: 5000,          // Fast 5-second connection timeout
    socketTimeoutMS: 45000,          // 45s socket timeout to release dead sockets quickly
    maxPoolSize: isServerless ? 10 : 50, // Connection pool size
    minPoolSize: isServerless ? 0 : 5,    // Pre-warm connections to eliminate cold start query latency
    maxIdleTimeMS: 120000,          // 2 minutes max idle before recycling socket
    heartbeatFrequencyMS: 10000,    // Ping every 10 seconds to detect network drops fast
    family: 4,                      // Force IPv4
    retryWrites: true,
    retryReads: true,
  };

  let retries = 5;
  while (retries > 0) {
    try {
      isConnecting = true;
      await mongoose.connect(uri, options);
      isConnecting = false;
      return;
    } catch (err) {
      console.error(`Database connection attempt failed (${retries} retries left):`, err.message);
      retries -= 1;
      if (retries === 0) {
        isConnecting = false;
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

