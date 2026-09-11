import { PLATFORM_FEE_PERCENT } from "../config/gameConfig.js";

// Isolated so the payout rule can change later without touching route logic.
// Prize = combined virtual-coin entry pool minus a configurable platform fee.
export function calculatePrizeCoins(entryCoins, playerCount = 2) {
  const pool = entryCoins * playerCount;
  const fee = Math.floor((pool * PLATFORM_FEE_PERCENT) / 100);
  return pool - fee;
}
