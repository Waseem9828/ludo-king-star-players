import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getSystemHealth, getServerIp, cleanupAllMatchImages, cleanupAllKycImages, cleanupDeposits, cleanupWithdrawals } from "../../lib/adminApi.js";
import Loading from "../../components/Loading.jsx";
import toast from "react-hot-toast";

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

export default function AdminSystemHealth() {
  const { token } = useAuth();
  const [health, setHealth] = useState(null);
  const [ipData, setIpData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cleaning, setCleaning] = useState("");


  const fetchHealth = async () => {
    setLoading(true);
    setError("");
    try {
      const [healthRes, ipRes] = await Promise.allSettled([
        getSystemHealth(token),
        getServerIp(token)
      ]);

      if (healthRes.status === "fulfilled") {
        setHealth(healthRes.value);
      } else {
        const rawMsg = healthRes.reason?.message || "Server unreachable";
        const cleanMsg = rawMsg === "Failed to fetch" ? "Backend server is starting up or network connection was interrupted. Please click Refresh." : rawMsg;
        setError("System Health Notice: " + cleanMsg);
      }

      if (ipRes.status === "fulfilled") {
        setIpData(ipRes.value);
      } else {
        setIpData({ outboundIp: "Unable to detect", isProxyActive: false });
      }
    } catch (err) {
      setError("System Health Notice: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, [token]);

  const handleCleanupAction = async (actionType, apiCall, label) => {
    if (!window.confirm(`Are you sure you want to perform ${label}? This will free up database storage.`)) return;
    setCleaning(actionType);
    try {
      const res = await apiCall(token);
      toast.success(res.message);
      fetchHealth();
    } catch (err) {
      toast.error("Cleanup error: " + err.message);
    } finally {
      setCleaning("");
    }
  };

  if (loading && !health) {
    return <Loading label="Checking system health metrics..." />;
  }

  const memoryPercent = health ? Math.round((health.memory.heapUsedMb / health.memory.heapTotalMb) * 100) : 0;

  return (
    <div className="stack">
      <div className="row-between" style={{ alignItems: "center" }}>
        <div>
          <h1>🏥 System Health & Storage</h1>
          <p className="text-muted">Real-time status of backend server, MongoDB database, memory, and storage metrics.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchHealth} disabled={loading}>
          🔄 Refresh
        </button>
      </div>

      {error && <p className="notice-banner error">{error}</p>}

      {health && (
        <>
          {/* Status Overview Cards */}
          <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div className="card" style={{ borderLeft: "4px solid #22c55e" }}>
              <span className="text-faint" style={{ fontSize: "12px", textTransform: "uppercase" }}>Database Status</span>
              <div className="row-between" style={{ marginTop: "6px", alignItems: "center" }}>
                <strong style={{ fontSize: "1.2rem", color: health.database.readyState === 1 ? "#16a34a" : "#dc2626" }}>
                  {health.database.status}
                </strong>
                <span className={"badge " + (health.database.readyState === 1 ? "badge-open" : "badge-full")}>
                  State {health.database.readyState}
                </span>
              </div>
              <p className="text-faint" style={{ fontSize: "12px", marginTop: "8px" }}>
                Host: {health.database.host} | DB: {health.database.name}
              </p>
            </div>

            <div className="card" style={{ borderLeft: "4px solid #3b82f6" }}>
              <span className="text-faint" style={{ fontSize: "12px", textTransform: "uppercase" }}>Server Uptime</span>
              <p style={{ fontSize: "1.2rem", fontWeight: "bold", marginTop: "6px", color: "var(--text)" }}>
                {formatUptime(health.uptimeSeconds)}
              </p>
              <p className="text-faint" style={{ fontSize: "12px", marginTop: "8px" }}>
                Env: {health.environment} | Node: {health.nodeVersion}
              </p>
            </div>

            <div className="card" style={{ borderLeft: "4px solid #f59e0b" }}>
              <span className="text-faint" style={{ fontSize: "12px", textTransform: "uppercase" }}>RAM Memory Usage</span>
              <div className="row-between" style={{ marginTop: "6px" }}>
                <strong style={{ fontSize: "1.1rem" }}>{health.memory.heapUsedMb} MB</strong>
                <span className="text-muted" style={{ fontSize: "13px" }}>of {health.memory.heapTotalMb} MB</span>
              </div>
              <p className="text-faint" style={{ fontSize: "11px", marginTop: "6px" }}>RSS Memory: {health.memory.rssMb} MB</p>
            </div>

            <div className="card" style={{ borderLeft: "4px solid #8b5cf6" }}>
              <div className="row-between" style={{ alignItems: "center" }}>
                <span className="text-faint" style={{ fontSize: "12px", textTransform: "uppercase" }}>🌐 Fixie Static Outbound IP</span>
                {ipData?.isProxyActive ? (
                  <span className="admin-badge success" style={{ fontSize: "9px", padding: "1px 6px" }}>⚡ Fixie Active</span>
                ) : (
                  <span className="admin-badge warning" style={{ fontSize: "9px", padding: "1px 6px" }}>Direct IP</span>
                )}
              </div>
              <div className="row-between" style={{ marginTop: "6px", alignItems: "center" }}>
                <strong style={{ fontSize: "1.1rem", color: "#8b5cf6", letterSpacing: "0.5px" }}>
                  {ipData?.outboundIp || "Loading..."}
                </strong>
                <button
                  className="btn btn-sm btn-ghost"
                  style={{ fontSize: "11px", padding: "2px 8px" }}
                  onClick={() => {
                    if (ipData?.outboundIp) {
                      navigator.clipboard.writeText(ipData.outboundIp);
                      alert("Outbound IP copied to clipboard!");
                    }
                  }}
                >
                  📋 Copy
                </button>
              </div>
              <p className="text-faint" style={{ fontSize: "11px", marginTop: "8px" }}>
                {ipData?.isProxyActive
                  ? `Proxy Host: ${ipData.proxyHost || "Fixie"}. Give this exact static IP to your KYC / Aadhaar gateway provider to whitelist.`
                  : "Whitelist this IP in IMB Payment / KYC merchant portal."}
              </p>
            </div>
          </div>

          {/* Collection Document Counts */}
          <div className="card">
            <h3 style={{ marginBottom: "12px" }}>📊 Database Records Summary</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
              <div style={{ background: "var(--bg-lighter)", padding: "12px", borderRadius: "10px", textAlign: "center" }}>
                <span className="text-faint" style={{ fontSize: "12px" }}>Total Users</span>
                <p style={{ fontSize: "1.3rem", fontWeight: "800", color: "#ef4444" }}>{health.counts.users}</p>
              </div>
              <div style={{ background: "var(--bg-lighter)", padding: "12px", borderRadius: "10px", textAlign: "center" }}>
                <span className="text-faint" style={{ fontSize: "12px" }}>Total Matches</span>
                <p style={{ fontSize: "1.3rem", fontWeight: "800", color: "#3b82f6" }}>{health.counts.matches}</p>
              </div>
              <div style={{ background: "var(--bg-lighter)", padding: "12px", borderRadius: "10px", textAlign: "center" }}>
                <span className="text-faint" style={{ fontSize: "12px" }}>Transactions</span>
                <p style={{ fontSize: "1.3rem", fontWeight: "800", color: "#8b5cf6" }}>{health.counts.transactions}</p>
              </div>
              <div style={{ background: "var(--bg-lighter)", padding: "12px", borderRadius: "10px", textAlign: "center" }}>
                <span className="text-faint" style={{ fontSize: "12px" }}>Deposits</span>
                <p style={{ fontSize: "1.3rem", fontWeight: "800", color: "#22c55e" }}>{health.counts.paymentOrders}</p>
              </div>
              <div style={{ background: "var(--bg-lighter)", padding: "12px", borderRadius: "10px", textAlign: "center" }}>
                <span className="text-faint" style={{ fontSize: "12px" }}>Withdrawals</span>
                <p style={{ fontSize: "1.3rem", fontWeight: "800", color: "#f59e0b" }}>{health.counts.withdrawals}</p>
              </div>
              <div style={{ background: "var(--bg-lighter)", padding: "12px", borderRadius: "10px", textAlign: "center" }}>
                <span className="text-faint" style={{ fontSize: "12px" }}>KYC Records</span>
                <p style={{ fontSize: "1.3rem", fontWeight: "800", color: "#06b6d4" }}>{health.counts.kycs}</p>
              </div>
            </div>
          </div>

          {/* Quick Storage Cleanup Operations */}
          <div className="card">
            <h3 style={{ marginBottom: "8px" }}>🧹 Database Storage Optimization</h3>
            <p className="text-muted" style={{ marginBottom: "16px", fontSize: "13px" }}>
              Purge heavy base64 screenshot images and completed records to keep MongoDB size within free tier limits.
            </p>

            <div className="stack" style={{ gap: "12px" }}>
              <div className="row-between" style={{ background: "var(--bg-lighter)", padding: "12px 16px", borderRadius: "12px", alignItems: "center" }}>
                <div>
                  <strong>🖼️ Match Proof Screenshots</strong>
                  <p className="text-muted" style={{ fontSize: "12px" }}>
                    {health.cleanableStorage.matchProofImages} finished matches have screenshots.
                  </p>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: "#ef4444" }}
                  disabled={health.cleanableStorage.matchProofImages === 0 || cleaning === "match-images"}
                  onClick={() => handleCleanupAction("match-images", cleanupAllMatchImages, "Match Proof Image Purge")}
                >
                  Clear Match Images
                </button>
              </div>

              <div className="row-between" style={{ background: "var(--bg-lighter)", padding: "12px 16px", borderRadius: "12px", alignItems: "center" }}>
                <div>
                  <strong>🪪 Processed KYC Documents</strong>
                  <p className="text-muted" style={{ fontSize: "12px" }}>
                    {health.cleanableStorage.kycImages} verified/rejected KYCs contain heavy base64 Aadhaar images.
                  </p>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: "#ef4444" }}
                  disabled={health.cleanableStorage.kycImages === 0 || cleaning === "kyc-images"}
                  onClick={() => handleCleanupAction("kyc-images", cleanupAllKycImages, "KYC Document Image Purge")}
                >
                  Clear KYC Images
                </button>
              </div>

              <div className="row-between" style={{ background: "var(--bg-lighter)", padding: "12px 16px", borderRadius: "12px", alignItems: "center" }}>
                <div>
                  <strong>💳 Processed Deposit Orders</strong>
                  <p className="text-muted" style={{ fontSize: "12px" }}>
                    {health.cleanableStorage.processedDeposits} completed/failed UPI payment records.
                  </p>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: "#ef4444" }}
                  disabled={health.cleanableStorage.processedDeposits === 0 || cleaning === "deposits"}
                  onClick={() => handleCleanupAction("deposits", cleanupDeposits, "Deposit Record Cleanup")}
                >
                  Cleanup Deposit History
                </button>
              </div>

              <div className="row-between" style={{ background: "var(--bg-lighter)", padding: "12px 16px", borderRadius: "12px", alignItems: "center" }}>
                <div>
                  <strong>💸 Processed Withdrawal Records</strong>
                  <p className="text-muted" style={{ fontSize: "12px" }}>
                    {health.cleanableStorage.processedWithdrawals} approved/rejected withdrawal request logs.
                  </p>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: "#ef4444" }}
                  disabled={health.cleanableStorage.processedWithdrawals === 0 || cleaning === "withdrawals"}
                  onClick={() => handleCleanupAction("withdrawals", cleanupWithdrawals, "Withdrawal Record Cleanup")}
                >
                  Cleanup Withdrawals
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
