import "dotenv/config";
import dns from "node:dns";
import express from "express";

// Ensure fast public DNS resolution globally for local development (bypasses ISP DNS blocks)
if (!process.env.VERCEL) {
  try {
    if (dns.setDefaultResultOrder) {
      dns.setDefaultResultOrder("ipv4first");
    }
    dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
  } catch (e) {
    // Ignore if environment forbids setting custom DNS servers
  }
}

import cors from "cors";
import compression from "compression";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import { validateEnvironment } from "./config/envValidator.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";

// Run startup environment audit
validateEnvironment();

import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import matchesRoutes from "./routes/matches.js";
import walletRoutes from "./routes/wallet.js";
import referralRoutes from "./routes/referral.js";
import withdrawalsRoutes from "./routes/withdrawals.js";
import historyRoutes from "./routes/history.js";
import adminRoutes from "./routes/admin.js";
import ownerRoutes from "./routes/owner.js";
import settingsRoutes from "./routes/settings.js";
import paymentRoutes from "./routes/payment.js";
import bannerRoutes from "./routes/banners.js";
import supportRoutes from "./routes/support.js";
import leaderboardRoutes from "./routes/leaderboard.js";
import notificationsRoutes from "./routes/notifications.js";
import kycRoutes from "./routes/kyc.js";
import practiceRoutes from "./routes/practice.js";
import webhookRoutes from "./routes/webhooks.js";

import { mongoSanitize } from "./middleware/mongoSanitize.js";

const app = express();
app.set("trust proxy", 1);

// HTTP Security & Anti-Inspection Headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("X-Download-Options", "noopen");

  // Prevent browser devtools/cache from caching private API responses
  if (req.path.startsWith("/api")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  res.removeHeader("X-Powered-By");
  next();
});

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : "*";

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(compression());
app.use(express.json({ limit: "6mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Anti-NoSQL Injection Guard (Strips $ and . operator injections)
app.use(mongoSanitize);

import rateLimit from "express-rate-limit";
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: { message: "Too many requests, please try again later." }
});
app.use("/api", apiLimiter);

app.get("/api/health", async (req, res) => {
  let dbState = mongoose.connection.readyState;
  let dbError = null;
  if (dbState !== 1) {
    try {
      await connectDB();
      dbState = mongoose.connection.readyState;
    } catch (err) {
      dbError = err.message;
    }
  }

  res.json({
    status: dbState === 1 ? "ok" : "degraded",
    dbReadyState: dbState,
    dbStateLabel: { 0: "Disconnected", 1: "Connected", 2: "Connecting", 3: "Disconnecting" }[dbState] || "Unknown",
    hasMongoUri: Boolean(process.env.MONGO_URI || process.env.MONGODB_URI),
    dbError,
  });
});

const APP_VERSION = process.env.APP_VERSION || "1.3.1";

app.get("/api/version", (req, res) => {
  res.json({
    version: APP_VERSION,
    timestamp: Date.now(),
  });
});

// DB Connection Guard Middleware: Ensures MongoDB connection is ready for Serverless & long-running instances.
app.use(async (req, res, next) => {
  if (req.path === "/api/health" || req.path === "/health") return next();

  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
    } catch (err) {
      console.error("DB connection attempt in middleware:", err.message);
      // Wait briefly for background connection to transition readyState
      try {
        await new Promise((r) => setTimeout(r, 600));
        if (mongoose.connection.readyState !== 1) {
          await connectDB();
        }
      } catch (retryErr) {
        console.error("DB retry attempt error:", retryErr.message);
      }
    }
  }

  return next();
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/matches", matchesRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/referral", referralRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/withdrawals", withdrawalsRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/owner", ownerRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/practice", practiceRoutes);
app.use("/api/webhooks", webhookRoutes);

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendDist = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

// Connect to MongoDB & initialize HTTP / Socket.io server locally (Skip on Vercel Serverless)
if (!process.env.VERCEL) {
  import("http").then(({ default: http }) => {
    import("./config/socket.js").then(({ initSocket }) => {
      const server = http.createServer(app);
      initSocket(server);
      const PORT = process.env.PORT || 5000;

      connectDB()
        .then(() => console.log("Database connected successfully."))
        .catch((err) => console.error("Initial DB connection warning:", err.message))
        .finally(() => {
          server.listen(PORT, "0.0.0.0", () =>
            console.log(`Server running on port ${PORT}, bound to 0.0.0.0 (LAN & WebSocket accessible)`)
          );
        });
    });
  });
}

export default app;
