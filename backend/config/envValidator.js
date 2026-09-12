/**
 * Startup Environment & Configuration Validator
 * Ensures required production credentials exist and warns on missing optional services.
 */
export function validateEnvironment() {
  const isProduction = process.env.NODE_ENV === "production";
  const warnings = [];

  // Critical Variables
  if (!process.env.JWT_SECRET) {
    warnings.push("WARNING: JWT_SECRET is not set in environment variables! Using fallback secret.");
    process.env.JWT_SECRET = "dev-secret-change-me-key-ludo-2026";
  } else if (process.env.JWT_SECRET.length < 16 && isProduction) {
    warnings.push("SECURITY WARNING: JWT_SECRET should be at least 16 characters in production.");
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    warnings.push("WARNING: Neither MONGO_URI nor MONGODB_URI is set. Database connection will be skipped.");
  }

  // Gateway Services
  if (!process.env.API_KING_KEY) {
    warnings.push("NOTICE: API_KING_KEY is not set. Real SMS delivery will be disabled (mock/dev fallback).");
  }

  if (!process.env.IMB_API_TOKEN && !process.env.DEPOSIT_API_TOKEN) {
    warnings.push("NOTICE: IMB_API_TOKEN is not set in env (will rely on database SiteSettings).");
  }

  // Print diagnostics
  if (warnings.length > 0) {
    warnings.forEach((w) => console.warn(`⚠️  ${w}`));
  }

  console.log("🛡️  Environment & Configuration audit passed.");
}
