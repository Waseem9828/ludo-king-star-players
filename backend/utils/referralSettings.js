import ReferralSettings from "../models/ReferralSettings.js";

// Race-safe singleton fetch: creates or defaults referral settings.
export async function getReferralSettings() {
  try {
    let settings = await ReferralSettings.findOne();
    if (!settings) {
      settings = await ReferralSettings.create({
        commissionEnabled: true,
        commissionPercentage: 2,
        maxCommissionAmount: 0,
      });
    }
    return settings;
  } catch (err) {
    if (err?.code === 11000) {
      return ReferralSettings.findOne();
    }
    throw err;
  }
}
