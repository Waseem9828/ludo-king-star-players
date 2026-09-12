import mongoose from "mongoose";

const siteSettingsSchema = new mongoose.Schema(
  {
    homeNoticeText: {
      type: String,
      default: "सभी PLAYERS उसी Name से पैसा डाले जिस Name से KYC है, अलग Name से डालेंगे counter हो जाएगा...",
    },
    minDeposit: { type: Number, default: 100 },
    maxDeposit: { type: Number, default: 100000 },
    minWithdrawal: { type: Number, default: 300 },
    maxWithdrawal: { type: Number, default: 100000 },
    withdrawalCooldownHours: { type: Number, default: 24 },
    withdrawalStartTime: { type: String, default: "00:00" }, // HH:MM 24‑hour format
    withdrawalEndTime: { type: String, default: "23:59" }, // HH:MM 24‑hour format
    imbApiToken: { type: String, default: "" },
    imbClientId: { type: String, default: "" },
    kycMerchantCode: { type: String, default: "IMBPY00519" },
    kycClientId: { type: String, default: "IMBZP1S4BZL3WOLNFOFUYY0CC" },
    kycClientSecret: { type: String, default: "imb_prod_u9atxsjs55juf19ztvpvsrkxzqvj01xq" },
    fixieUrl: { type: String, default: "http://fixie:KMfuoyd8zM5C2jj@ventoux.usefixie.com:80" },
    battleDividerImage: { type: String, default: "" },
    myBattlesDividerImage: { type: String, default: "" },
    openBattlesDividerImage: { type: String, default: "" },
    runningBattlesDividerImage: { type: String, default: "" },
    leaderboardBannerImage: { type: String, default: "" },
    supportWhatsapp: { type: String, default: "" },
    gameCardImage1: { type: String, default: "" },
    gameCardImage2: { type: String, default: "" },
    ludoRoomApiKey: { type: String, default: "" },
  },
  { timestamps: true }
);

const SiteSettings = mongoose.model("SiteSettings", siteSettingsSchema);
export default SiteSettings;
