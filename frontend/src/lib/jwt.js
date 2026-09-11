// Reads the payload of a JWT for local display purposes only — this does
// NOT verify the signature. The backend is the only source of truth for
// whether a token is actually valid; this just lets the dev-only login
// panel show the right name/role after you paste a token.
export function decodeJwtPayload(token) {
  try {
    const [, payload] = token.trim().split(".");
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}
