export function notFoundHandler(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
}

const DB_ERROR_NAMES = new Set([
  "MongooseError",
  "MongoError",
  "MongoServerError",
  "MongoServerSelectionError",
  "MongoNetworkError",
  "MongoTimeoutError",
]);

export function errorHandler(err, req, res, next) {
  console.error(err);

  // A DB-connectivity failure that slipped past the readyState check (e.g.
  // the connection dropped mid-request) — safe, specific message, never the
  // raw driver error (which can include connection strings/credentials).
  if (DB_ERROR_NAMES.has(err.name)) {
    return res.status(503).json({ message: "Database unavailable. Please try again in a moment." });
  }

  // Mongoose validation or cast errors should be 400 Bad Request
  if (err.name === "ValidationError" || err.name === "CastError") {
    return res.status(400).json({ message: err.message });
  }

  const status = err.status || 500;
  // Below 500, err.message is one of our own intentional validation/authorization
  // messages, safe to show as-is. At/above 500 it may be a raw driver/runtime
  // error (stack traces, connection strings, etc.) — never send that to clients.
  const message = status < 500 ? err.message || "Something went wrong. Please try again." : "Something went wrong. Please try again.";
  res.status(status).json({ message });
}
