import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { CloseIcon, LogoutIcon } from "../../../components/Icons.jsx";
import "../../../components/Sidebar.css";

const adminLinks = [
  { to: "/admin", label: "📊 Dashboard & Analytics", end: true },
  { to: "/admin/users", label: "👥 Users Inspector" },
  { to: "/admin/kyc", label: "🪪 Automatic KYC" },
  { to: "/admin/matches", label: "🎲 Ludo Matches" },
  { to: "/admin/withdrawals", label: "💸 Withdrawal Payouts" },
  { to: "/admin/deposit-history", label: "💳 Automatic Deposits" },
  { to: "/admin/notifications", label: "📢 Announcements" },
  { to: "/admin/dms", label: "🖼 Digital Management & Purge", ownerOnly: true },
  { to: "/admin/contacts", label: "📚 Contact Ledger", ownerOnly: true },
  { to: "/admin/referrals", label: "⚙️ Referral Settings", ownerOnly: true },
  { to: "/admin/site-settings", label: "🛠 Site Settings", ownerOnly: true },
  { to: "/admin/logs", label: "📋 Activity Logs", ownerOnly: true },
  { to: "/admin/system-health", label: "🏥 System Health & IP", ownerOnly: true },
];

export default function AdminSidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    onClose?.();
    navigate("/login");
  };

  return (
    <>
      <div className={"sidebar-backdrop" + (isOpen ? " is-open" : "")} onClick={onClose} />
      <aside className={"sidebar" + (isOpen ? " is-open" : "")}>
        <div className="sidebar-header">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="sidebar-avatar" style={{ background: "var(--primary-gradient)", color: "#ffffff", fontWeight: "bold", width: "36px", height: "36px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
              <span style={{ fontSize: "18px" }}>✦</span>
            </div>
            <div>
              <h2 className="sidebar-name" style={{ fontSize: "15px", margin: 0, fontWeight: "800" }}>Operations</h2>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>{user?.name || "Admin"} • {user?.role}</span>
            </div>
          </div>
          <button className="icon-btn sidebar-close" onClick={onClose} aria-label="Close menu">
            <CloseIcon size={22} />
          </button>
        </div>

        <nav className="sidebar-nav" style={{ padding: "16px 8px" }}>
          {adminLinks.filter(link => {
            const r = user?.role;
            if (r === "master" || r === "owner") return true;
            if (link.ownerOnly) return false;
            if (["finance_admin", "user_admin", "admin"].includes(r)) return true;
            return false;
          }).map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) => "sidebar-link" + (isActive ? " is-active" : "")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "13px",
                fontWeight: "700",
                padding: "12px 14px",
              }}
            >
              <span className="sidebar-link-left">
                <span className="sidebar-label">{label}</span>
              </span>
              <span className="sidebar-chevron">›</span>
            </NavLink>
          ))}
        </nav>

        <button
          className="sidebar-logout"
          onClick={handleLogout}
          style={{ background: "transparent", padding: "16px", display: "flex", alignItems: "center", gap: "10px", color: "var(--danger)", width: "100%", border: "none", cursor: "pointer" }}
        >
          <LogoutIcon size={18} />
          <span style={{ fontWeight: "800", fontSize: "14px" }}>Sign Out securely</span>
        </button>
      </aside>
    </>
  );
}
