import { useState } from "react";
import useSWR from "swr";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { setUserStatus, addMember, freezeWallet, adjustWallet } from "../../lib/adminApi.js";
import Loading from "../../components/Loading.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Modal from "../../components/Modal.jsx";
import AdminUserDetailModal from "./components/AdminUserDetailModal.jsx";
import { PlusIcon, WhatsappIcon } from "../../components/Icons.jsx";

export default function AdminUsers() {
  const { token, user: currentUser } = useAuth();
  const { data: usersData, error: swrError, mutate } = useSWR("/admin/users");
  const users = usersData || [];
  const loading = !usersData && !swrError;
  const [actionError, setActionError] = useState("");
  const error = swrError ? (swrError.message || String(swrError)) : actionError;
  const [updatingId, setUpdatingId] = useState(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [filterChip, setFilterChip] = useState("ALL");

  // Deep User Detail Inspector Modal state
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Add Member modal state
  const [isAddOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole, setAddRole] = useState("user");
  const [addError, setAddError] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Adjust Wallet modal state
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustUser, setAdjustUser] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustBucket, setAdjustBucket] = useState("DEPOSIT");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustError, setAdjustError] = useState("");
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  const openUserDetail = (userId) => {
    setSelectedUserId(userId);
    setDetailModalOpen(true);
  };

  const handleUserUpdatedInModal = (updatedUser) => {
    mutate((prev) => prev?.map((u) => (u._id === updatedUser._id ? { ...u, ...updatedUser } : u)), false);
  };

  const filteredUsers = users.filter((u) => {
    const text = `${u.name || ""} ${u.phone || ""} ${u._id || ""}`.toLowerCase();
    const matchesSearch = text.includes(searchTerm.toLowerCase().trim());

    let matchesFilter = true;
    if (filterChip === "PLAYERS") matchesFilter = !u.role || u.role === "user";
    if (filterChip === "ACTIVE") matchesFilter = u.status === "active";
    if (filterChip === "DISABLED") matchesFilter = u.status === "disabled";
    if (filterChip === "FROZEN") matchesFilter = Boolean(u.walletFrozen);
    if (filterChip === "ADMINS") matchesFilter = ["admin", "owner", "master", "finance_admin"].includes(u.role);

    return matchesSearch && matchesFilter;
  });

  const toggleStatus = async (user) => {
    const nextStatus = user.status === "disabled" ? "active" : "disabled";
    setUpdatingId(user._id);
    setActionError("");
    try {
      const updated = await setUserStatus(token, user._id, nextStatus);
      mutate((prev) => prev?.map((u) => (u._id === updated._id ? { ...u, status: updated.status } : u)), false);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleFreeze = async (user) => {
    const nextFreeze = !user.walletFrozen;
    setUpdatingId(user._id);
    setActionError("");
    try {
      const updated = await freezeWallet(token, user._id, nextFreeze);
      mutate((prev) => prev?.map((u) => (u._id === updated._id ? { ...u, walletFrozen: updated.walletFrozen } : u)), false);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const openAdjustModal = (user) => {
    setAdjustUser(user);
    setAdjustAmount("");
    setAdjustBucket("DEPOSIT");
    setAdjustNote("");
    setAdjustError("");
    setAdjustOpen(true);
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setAdjustError("");
    const amount = Number(adjustAmount);
    if (!Number.isInteger(amount) || amount === 0) {
      setAdjustError("Amount must be a non-zero integer.");
      return;
    }
    if (!adjustNote.trim()) {
      setAdjustError("Note is required.");
      return;
    }

    setAdjustSubmitting(true);
    try {
      await adjustWallet(token, adjustUser._id, {
        amount,
        bucket: adjustBucket,
        note: adjustNote.trim(),
      });
      setAdjustOpen(false);
      mutate();
    } catch (err) {
      setAdjustError(err.message);
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const openAddModal = () => {
    setAddName("");
    setAddPhone("");
    setAddPassword("");
    setAddRole("user");
    setAddError("");
    setAddOpen(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setAddError("");

    const trimmedName = addName.trim();
    const trimmedPhone = addPhone.trim();
    if (!trimmedName) {
      setAddError("Please enter a name.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(trimmedPhone)) {
      setAddError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (addPassword.length < 6) {
      setAddError("Password must be at least 6 characters.");
      return;
    }

    setAddSubmitting(true);
    try {
      const newUser = await addMember(token, {
        name: trimmedName,
        phone: trimmedPhone,
        password: addPassword,
        role: addRole,
      });
      setUsers((prev) => [newUser, ...prev]);
      setAddOpen(false);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddSubmitting(false);
    }
  };

  const filterChips = [
    { key: "ALL", label: `All (${users.length})` },
    { key: "PLAYERS", label: `Players (${users.filter((u) => !u.role || u.role === "user").length})` },
    { key: "ADMINS", label: `Admins & Staff (${users.filter((u) => ["admin", "owner", "master", "finance_admin"].includes(u.role)).length})` },
    { key: "ACTIVE", label: "Active" },
    { key: "DISABLED", label: "Disabled" },
    { key: "FROZEN", label: "Frozen" },
  ];

  return (
    <div className="stack" style={{ gap: "16px" }}>
      {/* PAGE HEADER */}
      <div className="admin-page-header">
        <div className="row-between" style={{ gap: "10px" }}>
          <h1>Users ({users.length})</h1>
          <button className="btn btn-primary btn-sm" onClick={openAddModal} style={{ minHeight: "36px", padding: "0 14px", borderRadius: "10px", fontSize: "12px" }}>
            <PlusIcon size={14} /> Add
          </button>
        </div>
        <span className="admin-page-header__subtitle">
          Manage all platform users, wallets, and account statuses
        </span>
      </div>

      {error && <p className="notice-banner error">{error}</p>}

      {/* SEARCH + FILTER */}
      <div className="admin-filter-bar">
        <input
          type="text"
          className="input"
          placeholder="Search name, phone, or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="admin-filter-chips">
          {filterChips.map((chip) => (
            <button
              key={chip.key}
              className={`admin-filter-chip ${filterChip === chip.key ? "is-active" : ""}`}
              onClick={() => setFilterChip(chip.key)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Loading label="Loading users..." />
      ) : filteredUsers.length === 0 ? (
        <div className="card">
          <EmptyState icon="👥" title="No Users Match" description="No users found matching your search or filter." />
        </div>
      ) : (
        <>
          {/* MOBILE CARD VIEW */}
          <div className="admin-mobile-cards">
            {filteredUsers.map((user) => (
              <div key={user._id} className="admin-mobile-card">
                <div className="admin-mobile-card__header">
                  <div className="admin-mobile-card__user" onClick={() => openUserDetail(user._id)} style={{ cursor: "pointer" }}>
                    <div className="admin-mobile-card__avatar">
                      {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="admin-mobile-card__name">{user.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
                        <span className="admin-mobile-card__sub">📱 {user.phone}</span>
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
                              width: "22px",
                              height: "22px",
                              borderRadius: "50%",
                              background: "#25D366",
                              color: "#ffffff",
                              boxShadow: "0 2px 6px rgba(37, 211, 102, 0.4)",
                              textDecoration: "none",
                              flexShrink: 0
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <WhatsappIcon size={13} color="#ffffff" />
                          </a>
                        )}
                      </div>
                      {user.role && user.role !== "user" && (
                        <span style={{ fontSize: "9px", background: "var(--primary)", color: "white", padding: "1px 6px", borderRadius: "4px", textTransform: "uppercase", fontWeight: "bold", marginTop: "2px", display: "inline-block" }}>
                          {user.role.replace("_", " ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
                    <span className={`admin-badge ${user.status === "disabled" ? "danger" : "success"}`} style={{ fontSize: "10px", padding: "2px 8px" }}>
                      {user.status === "disabled" ? "Disabled" : "Active"}
                    </span>
                    {user.walletFrozen && (
                      <span className="admin-badge warning" style={{ fontSize: "10px", padding: "2px 8px" }}>🔒 Frozen</span>
                    )}
                  </div>
                </div>

                <div className="admin-mobile-card__details">
                  <div className="admin-mobile-card__detail-item">
                    <span className="admin-mobile-card__detail-label">Total Chips</span>
                    <span className="admin-mobile-card__detail-value" style={{ color: "var(--primary)" }}>
                      {user.wallet?.totalCoins || 0}
                    </span>
                  </div>
                  <div className="admin-mobile-card__detail-item">
                    <span className="admin-mobile-card__detail-label">Deposit / Win</span>
                    <span className="admin-mobile-card__detail-value">
                      {user.wallet?.depositCoins || 0} / {user.wallet?.winningCoins || 0}
                    </span>
                  </div>
                  <div className="admin-mobile-card__detail-item">
                    <span className="admin-mobile-card__detail-label">Referrals</span>
                    <span className="admin-mobile-card__detail-value">{user.referralsCount || 0}</span>
                  </div>
                  <div className="admin-mobile-card__detail-item">
                    <span className="admin-mobile-card__detail-label">Joined</span>
                    <span className="admin-mobile-card__detail-value" style={{ fontSize: "11px" }}>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="admin-mobile-card__actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => openUserDetail(user._id)}
                  >
                    Inspect
                  </button>
                  {["master", "owner", "finance_admin"].includes(currentUser?.role) && (
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ color: "var(--text)", borderColor: "rgba(0,0,0,0.1)" }}
                      onClick={() => openAdjustModal(user)}
                    >
                      Adjust
                    </button>
                  )}
                  <button
                    className={`btn btn-sm ${user.status === "disabled" ? "btn-success" : "btn-danger"}`}
                    disabled={updatingId === user._id}
                    onClick={() => toggleStatus(user)}
                  >
                    {user.status === "disabled" ? "Enable" : "Disable"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* DESKTOP TABLE VIEW */}
          <div className="admin-table-desktop">
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User Profile</th>
                    <th>Wallet Chips</th>
                    <th>Referrals</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user._id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "10px",
                              background: "var(--primary-gradient)",
                              color: "#ffffff",
                              fontWeight: "bold",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "16px",
                              flexShrink: 0,
                              boxShadow: "0 2px 8px rgba(10, 81, 225, 0.2)"
                            }}
                          >
                            {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                          </div>
                          <div>
                            <div style={{ fontWeight: "800", color: "var(--text)", fontSize: "14px" }}>{user.name}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                              <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>📱 {user.phone}</span>
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
                                    width: "22px",
                                    height: "22px",
                                    borderRadius: "50%",
                                    background: "#25D366",
                                    color: "#ffffff",
                                    boxShadow: "0 2px 6px rgba(37, 211, 102, 0.4)",
                                    textDecoration: "none",
                                    flexShrink: 0
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <WhatsappIcon size={13} color="#ffffff" />
                                </a>
                              )}
                            </div>
                            {user.role && user.role !== "user" && (
                              <span style={{ fontSize: "10px", background: "var(--primary)", color: "white", padding: "2px 6px", borderRadius: "6px", textTransform: "uppercase", fontWeight: "bold", marginTop: "2px", display: "inline-block" }}>
                                {user.role.replace("_", " ")}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: "900", fontSize: "15px", color: "var(--primary)" }}>
                          {user.wallet?.totalCoins || 0} <span style={{ fontSize: "12px", fontWeight: "600" }}>CHIPS</span>
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>
                          Dep: {user.wallet?.depositCoins || 0} | Win: {user.wallet?.winningCoins || 0}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: "700", color: "var(--text)" }}>{user.referralsCount || 0} Friends</div>
                        <div style={{ fontSize: "11px", color: "var(--success)", fontWeight: "700" }}>+{user.referralEarnings || 0} Coins</div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-start" }}>
                          <span className={`admin-badge ${user.status === "disabled" ? "danger" : "success"}`}>
                            {user.status === "disabled" ? "Disabled" : "Active"}
                          </span>
                          {user.walletFrozen && (
                            <span className="admin-badge warning">🔒 Frozen</span>
                          )}
                        </div>
                      </td>
                      <td style={{ color: "var(--text-muted)", fontSize: "12px", fontWeight: "600" }}>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "nowrap" }}>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: "12px", padding: "6px 12px", borderRadius: "8px" }}
                            onClick={() => openUserDetail(user._id)}
                          >
                            Inspect
                          </button>
                          {["master", "owner", "finance_admin"].includes(currentUser?.role) && (
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ fontSize: "12px", padding: "6px 12px", borderRadius: "8px", color: "var(--text)", borderColor: "rgba(0,0,0,0.1)" }}
                              onClick={() => openAdjustModal(user)}
                            >
                              Adjust
                            </button>
                          )}
                          <button
                            className={`btn btn-sm ${user.status === "disabled" ? "btn-success" : "btn-danger"}`}
                            style={{ fontSize: "12px", padding: "6px 12px", borderRadius: "8px" }}
                            disabled={updatingId === user._id}
                            onClick={() => toggleStatus(user)}
                          >
                            {user.status === "disabled" ? "Enable" : "Disable"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* DEEP USER DETAIL INSPECTOR MODAL */}
      <AdminUserDetailModal
        isOpen={detailModalOpen}
        userId={selectedUserId}
        onClose={() => setDetailModalOpen(false)}
        onUserUpdated={handleUserUpdatedInModal}
      />

      {/* ADD MEMBER MODAL */}
      <Modal isOpen={isAddOpen} onClose={() => setAddOpen(false)} title="Add Member">
        <form className="stack" onSubmit={handleAddSubmit}>
          <div className="field">
            <label htmlFor="add-member-name">Full Name</label>
            <input
              id="add-member-name"
              className="input"
              type="text"
              placeholder="e.g. Ramesh Kumar"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              disabled={addSubmitting}
            />
          </div>
          <div className="field">
            <label htmlFor="add-member-phone">Mobile (10 Digits)</label>
            <input
              id="add-member-phone"
              className="input"
              type="tel"
              inputMode="numeric"
              placeholder="e.g. 9876543210"
              value={addPhone}
              onChange={(e) => setAddPhone(e.target.value)}
              disabled={addSubmitting}
            />
          </div>
          <div className="field">
            <label htmlFor="add-member-password">Password</label>
            <input
              id="add-member-password"
              className="input"
              type="password"
              placeholder="Min 6 characters"
              value={addPassword}
              onChange={(e) => setAddPassword(e.target.value)}
              disabled={addSubmitting}
            />
          </div>
          <div className="field">
            <label htmlFor="add-member-role">Role</label>
            <select
              id="add-member-role"
              className="input"
              value={addRole}
              onChange={(e) => setAddRole(e.target.value)}
              disabled={addSubmitting}
            >
              <option value="user">User (Player)</option>
              {["master", "owner"].includes(currentUser?.role) && (
                <>
                  <option value="finance_admin">Finance Manager (Finance & Users)</option>
                  <option value="admin">Admin (Legacy)</option>
                  <option value="owner">Owner</option>
                </>
              )}
              {currentUser?.role === "master" && <option value="master">Master</option>}
            </select>
          </div>
          {addError && <p className="notice-banner error">{addError}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={addSubmitting}>
            {addSubmitting ? "Creating..." : "Add Member"}
          </button>
        </form>
      </Modal>

      {/* ADJUST WALLET MODAL */}
      <Modal isOpen={adjustOpen} onClose={() => setAdjustOpen(false)} title={`Adjust: ${adjustUser?.name}`}>
        <form className="stack" onSubmit={handleAdjustSubmit}>
          <div className="field">
            <label htmlFor="adjust-amount">Amount (+ Add, - Deduct)</label>
            <input
              id="adjust-amount"
              className="input"
              type="number"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              disabled={adjustSubmitting}
            />
          </div>
          <div className="field">
            <label htmlFor="adjust-bucket">Wallet Bucket</label>
            <select
              id="adjust-bucket"
              className="input"
              value={adjustBucket}
              onChange={(e) => setAdjustBucket(e.target.value)}
              disabled={adjustSubmitting}
            >
              <option value="DEPOSIT">Deposit Coins</option>
              <option value="WINNING">Winning Coins</option>
              <option value="BONUS">Bonus Coins</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="adjust-note">Note / Reason</label>
            <input
              id="adjust-note"
              className="input"
              type="text"
              placeholder="e.g. Tournament reward"
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
              disabled={adjustSubmitting}
            />
          </div>
          {adjustError && <p className="notice-banner error">{adjustError}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={adjustSubmitting}>
            {adjustSubmitting ? "Processing..." : "Confirm Adjustment"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
