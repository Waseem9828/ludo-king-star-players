// Central place for virtual-coin game economy constants. Nothing here is
// real currency — changing these numbers only affects in-app virtual coins.
export const STARTING_COINS = 0; // welcome bonus removed — no free coins on registration
export const MIN_ENTRY_COINS = 50;
export const MAX_ENTRY_COINS = 5000;

export const PLATFORM_FEE_PERCENT = 5; // % taken from the combined entry pool

// "Add Virtual Coins" is a dev/test wallet top-up, not a real payment — these
// bounds just keep test amounts sane, not a pricing tier.
export const MIN_WALLET_TOPUP = 1;
export const MAX_WALLET_TOPUP = 10000;

// Referral rewards — granted once per successful referral, to both sides.
export const REFERRER_REWARD_COINS = 200;
export const REFERRED_USER_REWARD_COINS = 100;

// Withdrawals draw only from winningCoins (the withdrawable bucket).
export const MIN_WITHDRAWAL_COINS = 200;
