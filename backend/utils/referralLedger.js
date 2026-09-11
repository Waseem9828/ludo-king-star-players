import User from "../models/User.js";
import Referral from "../models/Referral.js";

// Looks up a referral code and, if valid, records the referral relationship.
// No sign-up coin bonuses are given — referrers earn only through the
// match commission system (configured in admin panel).
//
// Safe against duplicates/races: the unique index on Referral.referredUser
// means at most one Referral document can ever exist for a given new user.
export async function applyReferralIfValid(referralCodeInput, newUser, session = null) {
  if (!referralCodeInput || newUser.referredBy) return;

  const code = String(referralCodeInput).trim().toUpperCase();
  if (!code) return;

  const options = session ? { session } : {};

  const referrer = await User.findOne({ referralCode: code }).session(session);
  if (!referrer || referrer._id.equals(newUser._id)) return;

  try {
    const docs = await Referral.create(
      [
        {
          referrer: referrer._id,
          referredUser: newUser._id,
          referrerRewardCoins: 0,
          referredUserRewardCoins: 0,
        },
      ],
      options
    );

    // Save the referredBy link so match commissions can be paid later
    newUser.referredBy = referrer._id;
    await newUser.save(options);
    return docs[0];
  } catch (err) {
    if (err?.code === 11000) return; // duplicate referral attempt — safe no-op
    throw err;
  }
}

