const ERROR_MAP = {
  "Authentication token missing": "Session expire ho gaya. Phir se login karein.",
  "Invalid or expired token": "Session expire ho gaya. Phir se login karein.",
  "Load failed": "Internet connection check karein.",
  "Failed to fetch": "Server connection error. Internet check karein.",
  "Please fill in all required fields and try again.": "Kripya saari details fill karein.",
  "Insufficient coins": "Wallet me kam balance hai.",
  "Insufficient winning balance": "Winning wallet me kam balance hai.",
};

export function friendlyError(err, fallback = "Kuch galti hui. Phir try karein.") {
  const message = err?.message || (typeof err === "string" ? err : "");

  if (ERROR_MAP[message]) return ERROR_MAP[message];
  if (!message || message === "Load failed" || message === "Failed to fetch" || /NetworkError/i.test(message)) {
    return "Network error. Internet check karein.";
  }
  if (/^Request failed \(5\d\d\)$/.test(message)) return fallback;
  if (/^Missing required fields?/i.test(message)) return "Kripya saari details fill karein.";

  return message;
}
