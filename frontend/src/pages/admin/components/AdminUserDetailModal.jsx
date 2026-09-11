import { useEffect, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { getUserDetail, updateUserPassword, updateUserRole, setUserStatus, freezeWallet, adjustWallet } from "../../../lib/adminApi.js";
import Loading from "../../../components/Loading.jsx";
import Modal from "../../../components/Modal.jsx";
import { ShieldIcon, KeyIcon, LockIcon, CoinsIcon, HistoryIcon, UsersIcon, CheckCircleIcon, CrossCircleIcon, ClockIcon, WhatsappIcon } from "../../../components/Icons.jsx";

export default function AdminUserDetailModal({ isOpen, userId, onClose, onUserUpdated }) {
  const { token, user: currentUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  // Edit / Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [resetPassOpen, setResetPassOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetPassError, setResetPassError] = useState("");

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustBucket, setAdjustBucket] = useState("DEPOSIT");
  const [adjustType, setAdjustType] = useState("ADMIN_BONUS");
  const [adjustError, setAdjustError] = useState("");

  useEffect(() => {
    if (!isOpen || !userId) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    getUserDetail(token, userId)
      .then((res) => {
        if (!cancelled) {
          setData(res);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Failed to load user details.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, userId, token]);

  if (!isOpen) return null;

  const refreshData = async () => {
    try {
      const res = await getUserDetail(token, userId);
      setData(res);
      onUserUpdated?.(res.user);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStatus = async () => {
    if (!data?.user) return;
    const nextStatus = data.user.status === "disabled" ? "active" : "disabled";
    setActionLoading(true);
    try {
      await setUserStatus(token, userId, nextStatus);
      await refreshData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleFreeze = async () => {
    if (!data?.user) return;
    const nextFreeze = !data.user.walletFrozen;
    setActionLoading(true);
    try {
      await freezeWallet(token, userId, nextFreeze);
      await refreshData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangeRole = async (newRole) => {
    if (!data?.user || newRole === data.user.role) return;
    setActionLoading(true);
    try {
      await updateUserRole(token, userId, newRole);
      await refreshData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setResetPassError("");
    if (!newPassword || newPassword.length < 6) {
      setResetPassError("Password must be at least 6 characters.");
      return;
    }

    setActionLoading(true);
    try {
      await updateUserPassword(token, userId, newPassword);
      setResetPassOpen(false);
      setNewPassword("");
      alert("Password updated successfully!");
    } catch (err) {
      setResetPassError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setAdjustError("");
    let amount = Number(adjustAmount);
    if (!Number.isInteger(amount) || amount === 0) {
      setAdjustError("Amount must be a non-zero whole number.");
      return;
    }

    // Auto-negate amount if Penalty is selected and user passed positive number
    if (adjustType === "ADMIN_PENALTY" && amount > 0) {
      amount = -amount;
    }

    const noteMap = {
      "ADMIN_BONUS": "🎁 Bonus / Reward (Credit)",
      "ADMIN_PENALTY": "⚠️ Penalty / Fine (Deduction)",
      "ADMIN_ADJUSTMENT": "🔄 Manual Balance Correction",
      "PROMO_BONUS": "🏆 Promotional Campaign Bonus",
      "BATTLE_ERROR_REFUND": "🔙 Match Error Refund",
      "SYSTEM_ERROR_COMPENSATION": "⚙️ System Error Compensation",
      "MANUAL_DEPOSIT": "💵 Manual Offline Deposit",
      "TOURNAMENT_PRIZE": "🏅 Tournament Prize Winnings"
    };

    setActionLoading(true);
    try {
      await adjustWallet(token, userId, {
        amount,
        bucket: adjustBucket,
        adjustmentType: adjustType,
        note: noteMap[adjustType] || adjustType,
      });
      setAdjustOpen(false);
      setAdjustAmount("");
      await refreshData();
      alert("Wallet adjusted successfully.");
    } catch (err) {
      setAdjustError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const { user, wallet, transactions, matches, kyc, referrals } = data || {};

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="User Deep Detail Inspector" maxWidth="800px">
      {loading ? (
        <Loading label="Loading detailed user profile..." />
      ) : error ? (
        <p className="notice-banner error">{error}</p>
      ) : !user ? (
        <p>User record not found.</p>
      ) : (
        <div className="stack" style={{ gap: "20px" }}>
          {/* USER HEADER BANNER */}
          <div
            style={{
              background: "var(--primary-gradient)",
              padding: "20px",
              borderRadius: "14px",
              color: "white",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)",
            }}
          >
            <div className="row-between" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "#f59e0b",
                    color: "#000",
                    fontWeight: "bold",
                    fontSize: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 12px rgba(245, 158, 11, 0.4)",
                  }}
                >
                  {user.name?.[0]?.toUpperCase() || "U"}
                </div>
                <div>
                  <h2 style={{ color: "white", margin: 0, fontSize: "20px", fontWeight: "700" }}>{user.name}</h2>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                    <span style={{ color: "#94a3b8", fontSize: "14px" }}>📱 {user.phone}</span>
                    {user.phone && (
                      <a
                        href={`https://wa.me/91${user.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Chat on WhatsApp"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "24px",
                          height: "24px",
                          borderRadius: "50%",
                          background: "#25D366",
                          color: "#ffffff",
                          boxShadow: "0 2px 6px rgba(37, 211, 102, 0.4)",
                          textDecoration: "none",
                          flexShrink: 0
                        }}
                      >
                        <WhatsappIcon size={14} color="#ffffff" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: "600",
                    background: user.status === "disabled" ? "#ef4444" : "#10b981",
                    color: "white",
                  }}
                >
                  {user.status === "disabled" ? "Disabled" : "Active"}
                </span>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: "600",
                    background: user.walletFrozen ? "#dc2626" : "#3b82f6",
                    color: "white",
                  }}
                >
                  {user.walletFrozen ? "Wallet Frozen" : "Wallet Normal"}
                </span>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: "600",
                    background: "#6366f1",
                    color: "white",
                    textTransform: "capitalize",
                  }}
                >
                  Role: {user.role || "user"}
                </span>
              </div>
            </div>

            {/* QUICK ACTIONS TOOLBAR */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                paddingTop: "12px",
                borderTop: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <button
                className={`btn btn-sm ${user.status === "disabled" ? "btn-primary" : "btn-danger"}`}
                disabled={actionLoading}
                onClick={handleToggleStatus}
              >
                {user.status === "disabled" ? "Enable Account" : "Disable Account"}
              </button>

              <button
                className={`btn btn-sm ${user.walletFrozen ? "btn-primary" : "btn-danger"}`}
                disabled={actionLoading}
                onClick={handleToggleFreeze}
              >
                {user.walletFrozen ? "Unfreeze Wallet" : "Freeze Wallet"}
              </button>

              {["master", "owner", "finance_admin"].includes(currentUser?.role) && (
                <button
                  className="btn btn-sm btn-outline"
                  style={{ color: "#fbbf24", borderColor: "#fbbf24" }}
                  disabled={actionLoading}
                  onClick={() => setAdjustOpen(true)}
                >
                  <CoinsIcon size={14} /> Adjust Balance
                </button>
              )}

              <button
                className="btn btn-sm btn-outline"
                style={{ color: "#38bdf8", borderColor: "#38bdf8" }}
                disabled={actionLoading}
                onClick={() => setResetPassOpen(true)}
              >
                <KeyIcon size={14} /> Reset Password
              </button>

              {["master", "owner"].includes(currentUser?.role) && (
                <select
                  className="input"
                  style={{ width: "auto", padding: "4px 8px", fontSize: "12px", height: "32px" }}
                  value={user.role || "user"}
                  onChange={(e) => handleChangeRole(e.target.value)}
                  disabled={actionLoading}
                >
                  <option value="user">Role: User</option>
                  <option value="finance_admin">Role: Finance Manager (Finance & Users)</option>
                  <option value="admin">Role: Admin (Legacy)</option>
                  {["master", "owner"].includes(currentUser?.role) && <option value="owner">Role: Owner</option>}
                  {currentUser?.role === "master" && <option value="master">Role: Master</option>}
                </select>
              )}
            </div>
          </div>

          {/* DETAILED TABS NAVIGATION */}
          <div className="admin-tabs" style={{ background: "var(--surface-alt)", padding: "6px", borderRadius: "12px" }}>
            {[
              { key: "overview", label: "💰 Wallet & Profile" },
              { key: "transactions", label: `📊 Ledger (${transactions?.length || 0})` },
              { key: "matches", label: `🎲 Matches (${matches?.length || 0})` },
              { key: "kyc", label: `🪪 KYC Details` },
              { key: "referrals", label: `👥 Referrals (${referrals?.length || 0})` },
            ].map((t) => (
              <button
                key={t.key}
                className={`admin-tabs__link ${activeTab === t.key ? "is-active" : ""}`}
                onClick={() => setActiveTab(t.key)}
                style={{ border: "none", cursor: "pointer" }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* TAB 1: OVERVIEW & WALLET */}
          {activeTab === "overview" && (
            <div className="stack" style={{ gap: "16px" }}>
              <div className="admin-stats-grid">
                <div className="stat-card" style={{ borderLeft: "4px solid #3b82f6" }}>
                  <p className="stat-label">Deposit Coins</p>
                  <p className="stat-value" style={{ color: "#3b82f6" }}>{wallet?.depositCoins || 0}</p>
                </div>
                <div className="stat-card" style={{ borderLeft: "4px solid #10b981" }}>
                  <p className="stat-label">Winning Coins</p>
                  <p className="stat-value" style={{ color: "#10b981" }}>{wallet?.winningCoins || 0}</p>
                </div>
                <div className="stat-card" style={{ borderLeft: "4px solid #f59e0b" }}>
                  <p className="stat-label">Bonus Coins</p>
                  <p className="stat-value" style={{ color: "#f59e0b" }}>{wallet?.bonusCoins || 0}</p>
                </div>
                <div className="stat-card" style={{ borderLeft: "4px solid #8b5cf6" }}>
                  <p className="stat-label">Total Balance</p>
                  <p className="stat-value" style={{ color: "#8b5cf6" }}>
                    {(wallet?.depositCoins || 0) + (wallet?.winningCoins || 0) + (wallet?.bonusCoins || 0)}
                  </p>
                </div>
              </div>

              <div className="card stack" style={{ padding: "16px" }}>
                <h4 style={{ margin: "0 0 12px" }}>Account Metadata</h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", fontSize: "13px" }}>
                  <div>
                    <p className="text-muted" style={{ margin: "0 0 2px" }}>Joined Date</p>
                    <p style={{ fontWeight: "600" }}>{new Date(user.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted" style={{ margin: "0 0 2px" }}>Referral Code</p>
                    <p style={{ fontWeight: "600", fontFamily: "monospace" }}>{user.referralCode || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted" style={{ margin: "0 0 2px" }}>KYC Status</p>
                    <p style={{ fontWeight: "600", color: kyc?.status === "verified" ? "var(--success)" : "var(--danger)" }}>
                      {kyc ? kyc.status.toUpperCase() : "NOT SUBMITTED"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRANSACTIONS LEDGER */}
          {activeTab === "transactions" && (
            <div className="stack" style={{ gap: "12px" }}>
              {transactions?.length === 0 ? (
                <p className="text-muted" style={{ padding: "20px", textAlign: "center" }}>No transactions found for this user.</p>
              ) : (
                <div className="admin-table-container" style={{ maxHeight: "360px" }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Type / Bucket</th>
                        <th>Amount</th>
                        <th>Balance After</th>
                        <th>Note</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => {
                        const isPositive = tx.amount > 0;
                        return (
                          <tr key={tx._id}>
                            <td>
                              <strong style={{ display: "block" }}>{tx.type}</strong>
                              <span className="text-muted" style={{ fontSize: "11px" }}>{tx.bucket || "MIXED"}</span>
                            </td>
                            <td style={{ fontWeight: "bold", color: isPositive ? "#10b981" : "#ef4444" }}>
                              {isPositive ? `+${tx.amount}` : tx.amount}
                            </td>
                            <td>{tx.balanceAfter}</td>
                            <td style={{ maxWidth: "200px", wordBreak: "break-word" }}>{tx.note || "—"}</td>
                            <td style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                              {new Date(tx.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MATCH HISTORY */}
          {activeTab === "matches" && (
            <div className="stack" style={{ gap: "12px" }}>
              {matches?.length === 0 ? (
                <p className="text-muted" style={{ padding: "20px", textAlign: "center" }}>No game matches found for this user.</p>
              ) : (
                <div style={{ maxHeight: "360px", overflowY: "auto" }} className="stack">
                  {matches.map((m) => {
                    const isCreator = String(m.creator?._id) === String(user._id);
                    const isWinner = m.winner && String(m.winner._id || m.winner) === String(user._id);
                    return (
                      <div key={m._id} className="card" style={{ padding: "12px", background: "var(--surface-alt)" }}>
                        <div className="row-between">
                          <div>
                            <span className="badge badge-open" style={{ fontSize: "11px" }}>{m.status}</span>
                            <strong style={{ marginLeft: "8px", fontSize: "14px" }}>Room: {m.roomCode || "—"}</strong>
                            <p className="text-muted" style={{ margin: "4px 0 0", fontSize: "12px" }}>
                              Vs {isCreator ? (m.opponent?.name || "Waiting") : (m.creator?.name || "Creator")}
                            </p>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <p style={{ fontWeight: "bold", color: isWinner ? "var(--success)" : "inherit" }}>
                              Entry: {m.entryCoins} | Prize: {m.prizeCoins}
                            </p>
                            {m.status === "COMPLETED" || m.status === "SETTLED" ? (
                              <span style={{ fontSize: "12px", fontWeight: "bold", color: isWinner ? "#10b981" : "#ef4444" }}>
                                {isWinner ? "🏆 WON" : "❌ LOST"}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: KYC DETAILS */}
          {activeTab === "kyc" && (
            <div className="card stack" style={{ padding: "16px" }}>
              <h4 style={{ margin: 0 }}>Automatic Aadhaar KYC Details</h4>
              {!kyc ? (
                <p className="text-muted">User has not submitted KYC yet.</p>
              ) : (
                <div className="stack" style={{ gap: "12px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", fontSize: "13px" }}>
                    <div>
                      <p className="text-muted" style={{ margin: "0 0 2px" }}>Aadhaar Number</p>
                      <p style={{ fontWeight: "bold", fontSize: "15px", fontFamily: "monospace" }}>{kyc.aadhaarNumber}</p>
                    </div>
                    <div>
                      <p className="text-muted" style={{ margin: "0 0 2px" }}>Verified Name</p>
                      <p style={{ fontWeight: "bold" }}>{kyc.name || user.name}</p>
                    </div>
                    {kyc.dob && (
                      <div>
                        <p className="text-muted" style={{ margin: "0 0 2px" }}>Date of Birth</p>
                        <p style={{ fontWeight: "600" }}>{kyc.dob}</p>
                      </div>
                    )}
                    {kyc.gender && (
                      <div>
                        <p className="text-muted" style={{ margin: "0 0 2px" }}>Gender</p>
                        <p style={{ fontWeight: "600" }}>{kyc.gender}</p>
                      </div>
                    )}
                    {kyc.careOf && (
                      <div>
                        <p className="text-muted" style={{ margin: "0 0 2px" }}>Care Of (C/O)</p>
                        <p>{kyc.careOf}</p>
                      </div>
                    )}
                    {kyc.address && (
                      <div style={{ gridColumn: "1 / -1" }}>
                        <p className="text-muted" style={{ margin: "0 0 2px" }}>Full Address</p>
                        <p style={{ fontWeight: "500" }}>{kyc.address} {kyc.pincode ? `- ${kyc.pincode}` : ""}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted" style={{ margin: "0 0 2px" }}>Verification Status</p>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: "bold",
                          background: kyc.status === "verified" ? "#10b981" : kyc.status === "rejected" ? "#ef4444" : "#f59e0b",
                          color: "white",
                        }}
                      >
                        {kyc.status.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-muted" style={{ margin: "0 0 2px" }}>Verification Note</p>
                      <p style={{ fontStyle: "italic" }}>{kyc.note || "Auto-verified via Aadhaar Gateway"}</p>
                    </div>
                    <div>
                      <p className="text-muted" style={{ margin: "0 0 2px" }}>Submitted Date</p>
                      <p>{new Date(kyc.submittedAt).toLocaleString()}</p>
                    </div>
                  </div>

                  {kyc.aadhaarImageUrl && (
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                      <p className="text-muted" style={{ fontSize: "12px", marginBottom: "8px" }}>Aadhaar Document Photo</p>
                      <img
                        src={kyc.aadhaarImageUrl}
                        alt="Aadhaar photo"
                        style={{ maxWidth: "300px", maxHeight: "180px", objectFit: "contain", borderRadius: "8px", border: "1px solid var(--border)" }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: REFERRALS */}
          {activeTab === "referrals" && (
            <div className="stack" style={{ gap: "12px" }}>
              {referrals?.length === 0 ? (
                <p className="text-muted" style={{ padding: "20px", textAlign: "center" }}>No invited referrals yet for this user.</p>
              ) : (
                <div style={{ maxHeight: "360px", overflowY: "auto" }} className="stack">
                  {referrals.map((ref) => (
                    <div key={ref._id} className="card row-between" style={{ padding: "12px", background: "var(--surface-alt)" }}>
                      <div>
                        <strong>{ref.name}</strong>
                        <p className="text-muted" style={{ margin: "2px 0 0", fontSize: "12px" }}>📱 {ref.phone}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span className="badge badge-open" style={{ fontSize: "11px" }}>{ref.status || "active"}</span>
                        <p className="text-muted" style={{ margin: "2px 0 0", fontSize: "11px" }}>
                          Joined: {new Date(ref.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      <Modal isOpen={resetPassOpen} onClose={() => setResetPassOpen(false)} title={`Reset Password: ${user?.name}`}>
        <form className="stack" onSubmit={handleResetPasswordSubmit}>
          <div className="field">
            <label htmlFor="new-user-pass">New Password (Min 6 characters)</label>
            <input
              id="new-user-pass"
              className="input"
              type="text"
              placeholder="Enter new password..."
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={actionLoading}
            />
          </div>
          {resetPassError && <p className="notice-banner error">{resetPassError}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={actionLoading}>
            {actionLoading ? "Updating..." : "Set New Password"}
          </button>
        </form>
      </Modal>

      {/* ADJUST WALLET BALANCE MODAL */}
      <Modal isOpen={adjustOpen} onClose={() => setAdjustOpen(false)} title={`Adjust Wallet Balance: ${user?.name}`}>
        <form className="stack" onSubmit={handleAdjustSubmit}>
          <div className="field">
            <label htmlFor="adj-type">Adjustment Category / Action Type</label>
            <select
              id="adj-type"
              className="input"
              value={adjustType}
              onChange={(e) => {
                const val = e.target.value;
                setAdjustType(val);
                if (val === "ADMIN_BONUS" || val === "PROMO_BONUS") {
                  setAdjustBucket("BONUS");
                }
              }}
              disabled={actionLoading}
            >
              <option value="ADMIN_BONUS">🎁 Bonus / Reward (Credit)</option>
              <option value="ADMIN_PENALTY">⚠️ Penalty / Fine (Deduction)</option>
              <option value="ADMIN_ADJUSTMENT">🔄 Manual Balance Correction</option>
              <option value="PROMO_BONUS">🏆 Promotional Campaign Bonus</option>
              <option value="BATTLE_ERROR_REFUND">🔙 Match Error Refund</option>
              <option value="SYSTEM_ERROR_COMPENSATION">⚙️ System Error Compensation</option>
              <option value="MANUAL_DEPOSIT">💵 Manual Offline Deposit</option>
              <option value="TOURNAMENT_PRIZE">🏅 Tournament Prize Winnings</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="adj-bucket">Target Wallet Bucket</label>
            <select
              id="adj-bucket"
              className="input"
              value={adjustBucket}
              onChange={(e) => setAdjustBucket(e.target.value)}
              disabled={actionLoading}
            >
              <option value="DEPOSIT">Deposit Coins</option>
              <option value="WINNING">Winning Coins</option>
              <option value="BONUS">Bonus Coins</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="adj-amount">
              Amount ({adjustType === "ADMIN_PENALTY" ? "Enter positive or negative number to deduct" : "Enter positive number to add, negative to deduct"})
            </label>
            <input
              id="adj-amount"
              className="input"
              type="number"
              placeholder={adjustType === "ADMIN_PENALTY" ? "e.g. 200 (deducts 200)" : "e.g. 500 or -200"}
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              disabled={actionLoading}
            />
          </div>
          {adjustError && <p className="notice-banner error">{adjustError}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={actionLoading}>
            {actionLoading ? "Processing..." : "Confirm Balance Adjustment"}
          </button>
        </form>
      </Modal>
    </Modal>
  );
}
