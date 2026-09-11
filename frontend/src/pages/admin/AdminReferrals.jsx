import { useState, useEffect } from "react";
import useSWR from "swr";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getReferralSettings, updateReferralSettings } from "../../lib/adminApi.js";
import Loading from "../../components/Loading.jsx";

export default function AdminReferrals() {
  const { token } = useAuth();
  const { data: settings, error, mutate } = useSWR("/admin/referral-settings");
  const loading = !settings && !error;

  const [commissionEnabled, setCommissionEnabled] = useState(true);
  const [commissionPercentage, setCommissionPercentage] = useState("5");
  const [maxCommissionAmount, setMaxCommissionAmount] = useState("500");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (settings) {
      setCommissionEnabled(Boolean(settings.commissionEnabled));
      setCommissionPercentage(String(settings.commissionPercentage ?? 5));
      setMaxCommissionAmount(String(settings.maxCommissionAmount ?? 500));
    }
  }, [settings]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveMsg("");
    setSaveError("");

    const pct = Number(commissionPercentage);
    const maxAmt = Number(maxCommissionAmount);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setSaveError("Commission percentage must be between 0 and 100.");
      return;
    }
    if (!Number.isFinite(maxAmt) || maxAmt < 0) {
      setSaveError("Max commission amount must be a positive number.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateReferralSettings(token, {
        commissionEnabled,
        commissionPercentage: pct,
        maxCommissionAmount: maxAmt,
      });
      mutate(updated, { revalidate: false });
      setSaveMsg("Referral settings updated successfully!");
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack" style={{ gap: "20px" }}>
      <div>
        <h1>Referral Commission Settings</h1>
        <p className="text-muted" style={{ margin: "2px 0 0" }}>
          Configure commission percentages awarded to players when their invited friends win battles
        </p>
      </div>

      {error && <p className="notice-banner error">{error.message}</p>}

      {loading ? (
        <Loading label="Loading referral settings..." />
      ) : (
        <form className="card stack" style={{ gap: "16px", padding: "20px" }} onSubmit={handleSave}>
          <div className="row-between" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "14px" }}>
            <div>
              <strong>Enable Referral Commission System</strong>
              <p className="text-muted" style={{ fontSize: "12px", margin: "2px 0 0" }}>
                When enabled, referrers receive a percentage of commission when their friends win matches.
              </p>
            </div>
            <button
              type="button"
              className={`btn btn-sm ${commissionEnabled ? "btn-primary" : "btn-outline"}`}
              onClick={() => setCommissionEnabled(!commissionEnabled)}
            >
              {commissionEnabled ? "✓ Enabled" : "✕ Disabled"}
            </button>
          </div>

          <div className="field">
            <label htmlFor="comm-pct">Referral Commission Percentage (%)</label>
            <input
              id="comm-pct"
              className="input"
              type="number"
              step="0.1"
              min="0"
              max="100"
              placeholder="e.g. 5"
              value={commissionPercentage}
              onChange={(e) => setCommissionPercentage(e.target.value)}
              disabled={saving || !commissionEnabled}
            />
            <p className="text-muted" style={{ fontSize: "11px", margin: "4px 0 0" }}>
              Percentage of match winnings credited to the referrer's wallet.
            </p>
          </div>

          <div className="field">
            <label htmlFor="max-comm">Max Commission Cap Per Battle (Coins)</label>
            <input
              id="max-comm"
              className="input"
              type="number"
              min="0"
              placeholder="e.g. 500"
              value={maxCommissionAmount}
              onChange={(e) => setMaxCommissionAmount(e.target.value)}
              disabled={saving || !commissionEnabled}
            />
            <p className="text-muted" style={{ fontSize: "11px", margin: "4px 0 0" }}>
              Maximum reward coins a referrer can earn from a single battle win.
            </p>
          </div>

          {saveError && <p className="notice-banner error">{saveError}</p>}
          {saveMsg && <p className="notice-banner success">{saveMsg}</p>}

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Referral Settings"}
          </button>
        </form>
      )}
    </div>
  );
}
