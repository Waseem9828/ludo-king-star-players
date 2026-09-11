const BACKEND_PORT = 5000;
// 15s per attempt for fast feedback on mobile/slow networks
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;

function inferApiBaseUrl() {
  if (typeof window === "undefined") return "http://localhost:5000/api";
  
  if (!window.location.port || window.location.port === "80" || window.location.port === "443") {
    return `${window.location.protocol}//${window.location.hostname}/api`;
  }
  
  return `${window.location.protocol}//${window.location.hostname}:${BACKEND_PORT}/api`;
}

export const API_BASE_URL = import.meta.env.VITE_API_URL || inferApiBaseUrl();

// Silent background wake-up call for cold-starting backend instances
if (typeof window !== "undefined") {
  const healthUrl = API_BASE_URL.replace(/\/api\/?$/, "") + "/api/health";
  fetch(healthUrl).catch(() => {});
}

/**
 * Perform fetch with automatic silent retries for network glitches, timeouts, or 503 errors.
 */
async function fetchWithRetry(url, options, retriesLeft = MAX_RETRIES) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    // If backend returns 503 (database reconnecting), retry if attempts remain
    if (res.status === 503 && retriesLeft > 0) {
      await new Promise((r) => setTimeout(r, 1000));
      return fetchWithRetry(url, options, retriesLeft - 1);
    }

    return res;
  } catch (err) {
    clearTimeout(timeout);
    // Retry on network errors or timeouts if retries left and method is GET or safe retry
    if (retriesLeft > 0 && (err.name === "AbortError" || err.message?.includes("Failed to fetch") || !err.status)) {
      await new Promise((r) => setTimeout(r, 800));
      return fetchWithRetry(url, options, retriesLeft - 1);
    }
    throw err;
  }
}

// Minimal fetch wrapper with auto-retry and friendly error handling
export async function apiRequest(path, options = {}) {
  const { headers: callerHeaders, ...restOptions } = options;
  const fullUrl = `${API_BASE_URL}${path}`;

  let res;
  try {
    res = await fetchWithRetry(fullUrl, {
      ...restOptions,
      headers: { "Content-Type": "application/json", ...callerHeaders },
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Network request timed out. Please check your connection and try again.");
    }
    if (err.message?.includes("Failed to fetch")) {
      throw new Error("Unable to connect to server. Please check your internet connection.");
    }
    throw err;
  }

  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:logout"));
      }
    }
    let message = `Request failed (${res.status})`;
    try {
      const text = await res.text();
      if (text && !text.startsWith("<!doctype") && !text.startsWith("<html")) {
        const data = JSON.parse(text);
        if (data?.message) message = data.message;
      }
    } catch {
      // Response had no valid JSON body
    }
    throw new Error(message);
  }

  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!text || text.trim() === "") return {};

  if (text.startsWith("<!doctype") || text.startsWith("<html") || !contentType.includes("application/json")) {
    // If server returned HTML instead of JSON (e.g. 404 route or wake-up HTML)
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Server is reconnecting. Please refresh in a moment.");
    }
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON response from server.");
  }
}

