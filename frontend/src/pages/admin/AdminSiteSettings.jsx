import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getAdminSiteSettings, updateAdminSiteSettings, getReferralSettings, updateReferralSettings, getLudoRoomProfile, purgeOldData } from "../../lib/adminApi.js";
import Loading from "../../components/Loading.jsx";

export default function AdminSiteSettings() {
  const { token } = useAuth();
  const [settings, setSettings] = useState(null);
  const [refSettings, setRefSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fetchingLudoRoom, setFetchingLudoRoom] = useState(false);
  const [ludoRoomProfile, setLudoRoomProfile] = useState(null);
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line
  }, []);

  const loadSettings = () => {
    setLoading(true);
    Promise.all([
      getAdminSiteSettings(token),
      getReferralSettings(token)
    ])
      .then(([siteData, refData]) => {
        setSettings(siteData);
        setRefSettings(refData);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const updatedSite = await updateAdminSiteSettings(token, {
        homeNoticeText: settings.homeNoticeText,
        minDeposit: Number(settings.minDeposit),
        maxDeposit: Number(settings.maxDeposit),
        minWithdrawal: Number(settings.minWithdrawal),
        maxWithdrawal: Number(settings.maxWithdrawal),
        withdrawalCooldownHours: Number(settings.withdrawalCooldownHours),
        withdrawalStartTime: settings.withdrawalStartTime,
        withdrawalEndTime: settings.withdrawalEndTime,
        imbApiToken: settings.imbApiToken,
        kycMerchantCode: settings.kycMerchantCode,
        kycClientId: settings.kycClientId,
        kycClientSecret: settings.kycClientSecret,
        battleDividerImage: settings.battleDividerImage,
        myBattlesDividerImage: settings.myBattlesDividerImage,
        openBattlesDividerImage: settings.openBattlesDividerImage,
        runningBattlesDividerImage: settings.runningBattlesDividerImage,
        leaderboardBannerImage: settings.leaderboardBannerImage,
        supportWhatsapp: settings.supportWhatsapp,
        supportTelegram: settings.supportTelegram,
        supportFacebook: settings.supportFacebook,
        supportInstagram: settings.supportInstagram,
        gameCardImage1: settings.gameCardImage1,
        gameCardImage2: settings.gameCardImage2,
        ludoRoomApiKey: settings.ludoRoomApiKey,
      });
      const updatedRef = await updateReferralSettings(token, {
        commissionEnabled: refSettings.commissionEnabled,
        commissionPercentage: Number(refSettings.commissionPercentage),
        maxCommissionAmount: Number(refSettings.maxCommissionAmount),
      });
      setSettings(updatedSite);
      setRefSettings(updatedRef);
      toast.success("Settings saved!");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckLudoRoom = async () => {
    if (!settings.ludoRoomApiKey) return;
    setFetchingLudoRoom(true);
    try {
      const data = await getLudoRoomProfile(token, settings.ludoRoomApiKey);
      setLudoRoomProfile(data.data);
      toast.success("LudoRoom Connection Verified!");
    } catch (err) {
      toast.error("LudoRoom Error: " + err.message);
      setLudoRoomProfile(null);
    } finally {
      setFetchingLudoRoom(false);
    }
  };

  const handlePurge = async () => {
    if (!window.confirm("WARNING: This will permanently delete all wallet histories, match records, images, and notifications older than 20 days. This CANNOT be undone. Are you sure?")) {
      return;
    }
    
    // extra confirmation
    const verify = window.prompt("Type 'DELETE' to confirm:");
    if (verify !== "DELETE") {
      toast.error("Deletion cancelled.");
      return;
    }

    setPurging(true);
    try {
      const res = await purgeOldData(token, 20);
      toast.success(res.message || "Old data purged successfully.");
      console.log("Purge details:", res.deletedCounts);
      alert(`Deleted:\nMatches: ${res.deletedCounts.matches}\nTransactions: ${res.deletedCounts.transactions}\nNotifications: ${res.deletedCounts.notifications}\nDeposits: ${res.deletedCounts.deposits}\nWithdrawals: ${res.deletedCounts.withdrawals}`);
    } catch (err) {
      toast.error("Failed to purge: " + err.message);
    } finally {
      setPurging(false);
    }
  };

  if (loading) return <Loading label="Loading settings..." />;
  if (!settings || !refSettings) return <p className="notice-banner">Failed to load settings.</p>;

  return (
    <div className="stack" style={{ gap: "16px" }}>
      <div className="admin-page-header">
        <h1>Site Settings</h1>
        <span className="admin-page-header__subtitle">Configure platform limits, integrations, and display assets</span>
      </div>

      <form className="stack" style={{ gap: "14px" }} onSubmit={handleSubmit}>
        {/* GENERAL */}
        <div className="card stack" style={{ padding: "14px", gap: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "14px" }}>📝 General</h3>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Home Notice Text</label>
            <textarea
              className="input"
              rows={2}
              style={{ height: "auto", padding: "10px 14px" }}
              value={settings.homeNoticeText || ""}
              onChange={(e) => setSettings({ ...settings, homeNoticeText: e.target.value })}
              placeholder="Notice on home page..."
            />
          </div>
          <div className="admin-form-grid">
            <div className="field" style={{ marginBottom: 0 }}>
              <label>📱 WhatsApp Support Number / Link</label>
              <input
                className="input"
                type="text"
                value={settings.supportWhatsapp || ""}
                onChange={(e) => setSettings({ ...settings, supportWhatsapp: e.target.value })}
                placeholder="e.g. 9876543210 or WhatsApp URL"
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>✈️ Telegram Link</label>
              <input
                className="input"
                type="text"
                value={settings.supportTelegram || ""}
                onChange={(e) => setSettings({ ...settings, supportTelegram: e.target.value })}
                placeholder="e.g. https://t.me/yourchannel"
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>📘 Facebook Page / Profile Link</label>
              <input
                className="input"
                type="text"
                value={settings.supportFacebook || ""}
                onChange={(e) => setSettings({ ...settings, supportFacebook: e.target.value })}
                placeholder="e.g. https://facebook.com/yourpage"
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>📸 Instagram Page / Profile Link</label>
              <input
                className="input"
                type="text"
                value={settings.supportInstagram || ""}
                onChange={(e) => setSettings({ ...settings, supportInstagram: e.target.value })}
                placeholder="e.g. https://instagram.com/yourhandle"
              />
            </div>
          </div>
        </div>

        {/* TRANSACTION LIMITS */}
        <div className="card stack" style={{ padding: "14px", gap: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "14px" }}>💰 Transaction Limits</h3>
          <div className="admin-form-grid">
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Min Deposit (₹)</label>
              <input
                className="input"
                type="number"
                min="0"
                value={settings.minDeposit ?? 100}
                onChange={(e) => setSettings({ ...settings, minDeposit: e.target.value })}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Max Deposit (₹)</label>
              <input
                className="input"
                type="number"
                min="0"
                value={settings.maxDeposit ?? 100000}
                onChange={(e) => setSettings({ ...settings, maxDeposit: e.target.value })}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Min Withdrawal</label>
              <input
                className="input"
                type="number"
                min="0"
                value={settings.minWithdrawal ?? 300}
                onChange={(e) => setSettings({ ...settings, minWithdrawal: e.target.value })}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Max Withdrawal</label>
              <input
                className="input"
                type="number"
                min="0"
                value={settings.maxWithdrawal ?? 100000}
                onChange={(e) => setSettings({ ...settings, maxWithdrawal: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* WITHDRAWAL TIMER */}
        <div className="card stack" style={{ padding: "14px", gap: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "14px" }}>⏱ Withdrawal Timer</h3>
          <div className="admin-form-grid">
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Cooldown (Hours)</label>
              <input
                className="input"
                type="number"
                min="0"
                value={settings.withdrawalCooldownHours ?? 24}
                onChange={(e) => setSettings({ ...settings, withdrawalCooldownHours: e.target.value })}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Start Time</label>
              <input
                className="input"
                type="time"
                value={settings.withdrawalStartTime ?? ""}
                onChange={(e) => setSettings({ ...settings, withdrawalStartTime: e.target.value })}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>End Time</label>
              <input
                className="input"
                type="time"
                value={settings.withdrawalEndTime ?? ""}
                onChange={(e) => setSettings({ ...settings, withdrawalEndTime: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* API INTEGRATIONS */}
        <div className="card stack" style={{ padding: "14px", gap: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "14px" }}>🔗 API Integrations</h3>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>IMB Deposit API Token</label>
            <input
              className="input"
              type="text"
              value={settings.imbApiToken || ""}
              onChange={(e) => setSettings({ ...settings, imbApiToken: e.target.value })}
              placeholder="e.g. e9b..."
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>LudoRoom API Key (Result Auto-Settlement)</label>
            <div className="row" style={{ gap: "8px" }}>
              <input
                className="input"
                type="text"
                style={{ flex: 1 }}
                value={settings.ludoRoomApiKey || ""}
                onChange={(e) => setSettings({ ...settings, ludoRoomApiKey: e.target.value })}
                placeholder="lr_..."
              />
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleCheckLudoRoom}
                disabled={!settings.ludoRoomApiKey || fetchingLudoRoom}
              >
                {fetchingLudoRoom ? "Checking..." : "Verify Connection"}
              </button>
            </div>
            {ludoRoomProfile && (
              <div className="card" style={{ marginTop: "12px", padding: "12px", background: "rgba(0,0,0,0.02)", border: "1px solid var(--border)", fontSize: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <strong>LudoRoom Status: {ludoRoomProfile.user?.status}</strong>
                  <span style={{ color: "var(--primary)", fontWeight: "bold" }}>{ludoRoomProfile.user?.creditsBalance} Credits</span>
                </div>
                {ludoRoomProfile.subscription && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span>Plan: {ludoRoomProfile.subscription.plan?.name}</span>
                    <span>Expires: {new Date(ludoRoomProfile.subscription.endAt).toLocaleDateString()}</span>
                  </div>
                )}
                {ludoRoomProfile.usage && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
                    <span>Total API Calls: {ludoRoomProfile.usage.totalCalls}</span>
                    <span style={{ color: "var(--danger)" }}>Failed: {ludoRoomProfile.usage.failedCalls}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="admin-form-grid">
            <div className="field" style={{ marginBottom: 0 }}>
              <label>KYC Merchant Code</label>
              <input
                className="input"
                type="text"
                value={settings.kycMerchantCode || ""}
                onChange={(e) => setSettings({ ...settings, kycMerchantCode: e.target.value })}
                placeholder="Merchant code"
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>KYC Client ID</label>
              <input
                className="input"
                type="text"
                value={settings.kycClientId || ""}
                onChange={(e) => setSettings({ ...settings, kycClientId: e.target.value })}
                placeholder="Client ID"
              />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>KYC Client Secret</label>
            <input
              className="input"
              type="password"
              value={settings.kycClientSecret || ""}
              onChange={(e) => setSettings({ ...settings, kycClientSecret: e.target.value })}
              placeholder="Client Secret"
            />
          </div>
        </div>

        {/* DATABASE MAINTENANCE */}
        <div className="card stack" style={{ padding: "14px", gap: "12px", border: "1px solid #ef4444" }}>
          <h3 style={{ margin: 0, fontSize: "14px", color: "#ef4444" }}>⚠️ Database Maintenance</h3>
          <p className="text-muted" style={{ margin: 0, fontSize: "13px" }}>
            Free up server storage by permanently deleting old records. This deletes complete wallet transaction history, complete match records, result screenshots, and notifications that are older than 20 days.
          </p>
          <div style={{ marginTop: "4px" }}>
            <button 
              type="button" 
              className="btn btn-danger" 
              onClick={handlePurge}
              disabled={purging}
              style={{ fontWeight: "bold" }}
            >
              {purging ? "Deleting Records..." : "Delete 20+ Days Old Data"}
            </button>
          </div>
        </div>

        {/* REFERRAL COMMISSION */}
        <div className="card stack" style={{ padding: "14px", gap: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "14px" }}>🤝 Referral Commission</h3>
          <p className="text-muted" style={{ fontSize: "11px", margin: 0 }}>
            Paid by platform from match fee — not deducted from winner.
          </p>
          <label className="row" style={{ cursor: "pointer", gap: "10px" }}>
            <input
              type="checkbox"
              checked={refSettings.commissionEnabled ?? false}
              onChange={(e) => setRefSettings({ ...refSettings, commissionEnabled: e.target.checked })}
              style={{ width: "18px", height: "18px", accentColor: "var(--primary)" }}
            />
            <span style={{ fontSize: "13px", fontWeight: "600" }}>Enable Commission</span>
          </label>
          <div className="admin-form-grid">
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Commission %</label>
              <input
                className="input"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={refSettings.commissionPercentage ?? 2}
                onChange={(e) => setRefSettings({ ...refSettings, commissionPercentage: e.target.value })}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Max Amount (Chips)</label>
              <input
                className="input"
                type="number"
                min="0"
                value={refSettings.maxCommissionAmount ?? 10}
                onChange={(e) => setRefSettings({ ...refSettings, maxCommissionAmount: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* BATTLE ASSETS */}
        <div className="card stack" style={{ padding: "14px", gap: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "14px" }}>🎨 Battle List Assets</h3>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Default Divider</label>
            <input
              className="input"
              type="text"
              value={settings.battleDividerImage || ""}
              onChange={(e) => setSettings({ ...settings, battleDividerImage: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="admin-form-grid">
            <div className="field" style={{ marginBottom: 0 }}>
              <label>My Battles Divider</label>
              <input
                className="input"
                type="text"
                value={settings.myBattlesDividerImage || ""}
                onChange={(e) => setSettings({ ...settings, myBattlesDividerImage: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Open Battles Divider</label>
              <input
                className="input"
                type="text"
                value={settings.openBattlesDividerImage || ""}
                onChange={(e) => setSettings({ ...settings, openBattlesDividerImage: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Running Battles Divider</label>
              <input
                className="input"
                type="text"
                value={settings.runningBattlesDividerImage || ""}
                onChange={(e) => setSettings({ ...settings, runningBattlesDividerImage: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Leaderboard Banner</label>
              <input
                className="input"
                type="text"
                value={settings.leaderboardBannerImage || ""}
                onChange={(e) => setSettings({ ...settings, leaderboardBannerImage: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>
        </div>

        {/* HOMEPAGE GAME CARDS */}
        <div className="card stack" style={{ padding: "14px", gap: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "14px" }}>🎮 Homepage Game Cards</h3>
          <p className="text-muted" style={{ fontSize: "11px", margin: 0 }}>
            Enter custom image URL to change card images on the homepage. Leave empty to use current default poster image.
          </p>
          <div className="admin-form-grid">
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Game Card 1 Image URL</label>
              <input
                className="input"
                type="text"
                value={settings.gameCardImage1 || ""}
                onChange={(e) => setSettings({ ...settings, gameCardImage1: e.target.value })}
                placeholder="Leave empty for default card image"
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Game Card 2 Image URL</label>
              <input
                className="input"
                type="text"
                value={settings.gameCardImage2 || ""}
                onChange={(e) => setSettings({ ...settings, gameCardImage2: e.target.value })}
                placeholder="Leave empty for default card image"
              />
            </div>
          </div>
        </div>

        {/* SAVE BUTTON - STICKY ON MOBILE */}
        <div style={{ position: "sticky", bottom: "70px", zIndex: 10 }}>
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting} style={{ borderRadius: "14px", boxShadow: "0 -4px 20px rgba(10,81,225,0.2)" }}>
            {submitting ? "Saving..." : "💾 Save All Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
