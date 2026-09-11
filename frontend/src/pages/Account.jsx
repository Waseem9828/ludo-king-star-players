import { useState } from "react";
import useSWR from "swr";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import Loading from "../components/Loading.jsx";
import Modal from "../components/Modal.jsx";
import AadhaarCard from "../components/AadhaarCard.jsx";
import { UserIcon } from "../components/Icons.jsx";
import { getAccountStats } from "../lib/usersApi.js";
import { getMyKyc } from "../lib/kycApi.js";
import { friendlyError } from "../lib/errors.js";
import toast from "react-hot-toast";
import "./Account.css";
import "./Kyc.css";

const UIDAI_LOGO_URL = "https://upload.wikimedia.org/wikipedia/en/c/cf/Aadhaar_Logo.svg";

const SwordIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"></path><path d="M13 19l6-6"></path><path d="M16 16l4 4"></path><path d="M19 21l2-2"></path><path d="M8.5 6.5L10 5"></path><path d="M17.5 14.5L19 13"></path><path d="M21 3l-6 6"></path><path d="M21 3v4"></path><path d="M21 3h-4"></path></svg>
);
const CoinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v8"></path><path d="M10 10h4"></path><path d="M10 14h4"></path></svg>
);
const UsersIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
);
const WarningIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
);
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--success)" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"></circle><path d="M9 12l2 2 4-4" stroke="#fff"></path></svg>
);
const CrossIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--danger)" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"></circle><path d="M15 9l-6 6" stroke="#fff"></path><path d="M9 9l6 6" stroke="#fff"></path></svg>
);
const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#ffc107" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"></circle><path d="M12 8v4l3 3" stroke="#fff"></path></svg>
);

export default function Account() {
  const { user, logout, isAuthenticated, initializing, updateProfile } = useAuth();
  const navigate = useNavigate();

  const { data: statsData, error: statsError } = useSWR(isAuthenticated ? "/users/me/stats" : null);
  const { data: kycData, error: kycError } = useSWR(isAuthenticated ? "/kyc/me" : null);

  const stats = statsData || null;
  const kyc = kycData || null;

  const loading = isAuthenticated && (!statsData && !statsError) && (!kycData && !kycError);
  const error = (statsError || kycError) ? friendlyError(statsError || kycError) : "";

  const [isEditOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [isKycModalOpen, setKycModalOpen] = useState(false);
  const [isLogoutModalOpen, setLogoutModalOpen] = useState(false);
  const [showFullAadhaar, setShowFullAadhaar] = useState(false);

  if (initializing) {
    return <Loading label="Loading..." />;
  }

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully!");
    navigate("/login");
  };

  const openEditModal = () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (kyc?.status === "verified") {
      toast.error("Name locked to verified Aadhaar.");
      return;
    }
    setEditName(user?.name || "");
    setEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error("Name cannot be empty.");
      return;
    }
    setEditSubmitting(true);
    try {
      await updateProfile({ name: trimmed });
      toast.success("Profile updated!");
      setEditOpen(false);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setEditSubmitting(false);
    }
  };

  const formatAadhaarDisplay = (num) => {
    if (!num) return "—";
    if (showFullAadhaar) {
      return `${num.slice(0, 4)} ${num.slice(4, 8)} ${num.slice(8, 12)}`;
    }
    return `XXXX XXXX ${num.slice(-4)}`;
  };

  return (
    <div className="account-page-wrapper">
      {/* Left column – Profile Card */}
      <div className="account-left">
        <div className="account-ui-card">
          <div className="account-ui-header">Profile</div>
          <div className="account-ui-body">
            <div className="account-ui-avatar-wrap">
              <div className="account-ui-avatar-circle">
                <img src="/logo.png" alt="User Avatar" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              </div>
            </div>

            <div className="account-ui-field">
              <span className="account-ui-label">Username</span>
              <div className="account-ui-input-group">
                <div className="account-ui-input">{user?.name || "Guest"}</div>
                <button className="account-ui-btn-edit" onClick={openEditModal}>Edit</button>
              </div>
            </div>

            <div className="account-ui-field">
              <span className="account-ui-label">Phone</span>
              <div className="account-ui-input">{user?.phone || "—"}</div>
            </div>
            <div className="account-ui-kyc-box">
              <div>
                <div className="account-ui-kyc-label">KYC status</div>
                <div className="account-ui-kyc-status">
                  {kyc?.status === "verified" ? (
                    <>Verified <CheckIcon /></>
                  ) : kyc?.status === "pending" ? (
                    <>Pending <ClockIcon /></>
                  ) : kyc?.status === "rejected" ? (
                    <>Rejected <CrossIcon /></>
                  ) : (
                    <>Unverified</>
                  )}
                </div>
              </div>
              <button 
                type="button" 
                className="account-ui-kyc-btn" 
                onClick={() => setKycModalOpen(true)}
              >
                View kyc detail
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right column – Metrics */}
      <div className="account-right">
        <div className="account-ui-card">
          <div className="account-ui-header">Metrics</div>
          <div className="account-ui-body">
            {error && <p className="notice-banner">{error}</p>}
            {loading ? (
              <Loading label="Loading metrics..." />
            ) : (
              <div className="account-ui-metrics-grid">
                <div className="account-ui-metric">
                  <div className="account-ui-metric-top"><SwordIcon /> Games Played</div>
                  <div className="account-ui-metric-val">{stats?.battlesPlayed || 0}</div>
                </div>
                <div className="account-ui-metric">
                  <div className="account-ui-metric-top"><CoinIcon /> Chips Won</div>
                  <div className="account-ui-metric-val">{stats?.totalWinnings || stats?.totalWithdrawal || 0}</div>
                </div>
                <div className="account-ui-metric">
                  <div className="account-ui-metric-top"><UsersIcon /> Referral Earning</div>
                  <div className="account-ui-metric-val">{stats?.referralEarnings || 0}</div>
                </div>
                <div className="account-ui-metric">
                  <div className="account-ui-metric-top"><WarningIcon /> Penalty</div>
                  <div className="account-ui-metric-val">0</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {isAuthenticated && (user?.role === "admin" || user?.role === "owner") && (
          <button className="account-ui-admin-btn" onClick={() => navigate("/admin")}>OPEN ADMIN PANEL</button>
        )}

        {isAuthenticated && (
          <button className="account-ui-logout" onClick={() => setLogoutModalOpen(true)}>LOG OUT</button>
        )}
      </div>

      {/* Edit Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setEditOpen(false)} title="Edit Profile">
        <form className="stack" onSubmit={handleEditSubmit}>
          <div className="field">
            <label htmlFor="edit-name">Name</label>
            <input id="edit-name" className="input" type="text" value={editName} onChange={(e) => setEditName(e.target.value)} disabled={editSubmitting} />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={editSubmitting}>
            {editSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </Modal>

      {/* Logout Confirmation Bottom Sheet Modal */}
      <Modal 
        isOpen={isLogoutModalOpen} 
        onClose={() => setLogoutModalOpen(false)} 
        variant="bottom-sheet"
      >
        <div className="logout-modal-content">
          <p className="logout-modal-title">Are you sure you want to log out?</p>
          <div className="logout-modal-buttons">
            <button
              type="button"
              className="logout-btn-confirm"
              onClick={handleLogout}
            >
              Yes, log out
            </button>
            <button
              type="button"
              className="logout-btn-cancel"
              onClick={() => setLogoutModalOpen(false)}
            >
              No cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* KYC Bottom Sheet Modal — STRICTLY ONLY AADHAAR CARD CONTAINER */}
      <Modal 
        isOpen={isKycModalOpen} 
        onClose={() => setKycModalOpen(false)} 
        variant="bottom-sheet"
      >
        {kyc ? (
          <AadhaarCard kyc={kyc} user={user} />
        ) : (
          <div style={{ padding: "24px 16px", textAlign: "center" }}>
            <p style={{ margin: "0 0 16px", fontWeight: "700", fontSize: "15px", color: "#1e293b" }}>
              KYC Not Completed
            </p>
            <button 
              className="btn btn-primary btn-block" 
              onClick={() => { setKycModalOpen(false); navigate("/kyc"); }}
            >
              Verify Aadhaar KYC Now
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
