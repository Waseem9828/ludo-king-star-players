import { HttpsProxyAgent } from "https-proxy-agent";

let cachedAgent = null;
let cachedProxyUrl = null;

/**
 * Returns an HttpsProxyAgent instance if FIXIE_URL, PROXY_URL, HTTP_PROXY, or HTTPS_PROXY
 * environment variables are set. Caches the agent instance for performance.
 */
export function getProxyAgent() {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) return null;

  if (proxyUrl !== cachedProxyUrl || !cachedAgent) {
    cachedProxyUrl = proxyUrl;
    cachedAgent = new HttpsProxyAgent(proxyUrl);
  }
  return cachedAgent;
}

/**
 * Returns the configured proxy URL string or null.
 */
export function getProxyUrl() {
  return (
    process.env.FIXIE_URL ||
    process.env.PROXY_URL ||
    process.env.HTTP_PROXY ||
    process.env.HTTPS_PROXY ||
    null
  );
}
