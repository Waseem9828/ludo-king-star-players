import SiteSettings from "../models/SiteSettings.js";

let cachedSettings = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 15000; // 15 seconds TTL

export async function getSiteSettings() {
  const now = Date.now();
  if (cachedSettings && (now - cacheTimestamp < CACHE_TTL_MS)) {
    return cachedSettings;
  }

  let settings = await SiteSettings.findOne();
  if (!settings) {
    settings = await SiteSettings.create({});
  }

  cachedSettings = settings;
  cacheTimestamp = now;
  return settings;
}

export function clearSiteSettingsCache() {
  cachedSettings = null;
  cacheTimestamp = 0;
}
