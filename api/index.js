import app from "../backend/server.js";

export default async function handler(req, res) {
  try {
    return await app(req, res);
  } catch (err) {
    console.error("Vercel Serverless Invocation Exception:", err);
    if (!res.headersSent) {
      return res.status(500).json({
        message: err.message || "Internal Server Error",
        status: 500
      });
    }
  }
}
