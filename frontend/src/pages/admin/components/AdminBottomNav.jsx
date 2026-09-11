import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { HomeIcon, UsersIcon, DiceIcon, WalletIcon, CoinsIcon } from "../../../components/Icons.jsx";
import { useAuth } from "../../../contexts/AuthContext.jsx";

/* Primary nav items - always visible at bottom */
const primaryItems = [
  { to: "/admin", label: "Dashboard", icon: "📊", end: true },
  { to: "/admin/withdrawals", label: "Payouts", icon: "💸" },
  { to: "/admin/kyc", label: "KYC", icon: "🪪" },
  { to: "/admin/matches", label: "Matches", icon: "🎲" },
];

/* "More" menu items - accessible via bottom sheet */
const moreItems = [
  { to: "/admin/users", label: "Users", icon: "👥" },
  { to: "/admin/deposit-history", label: "Deposits", icon: "💳" },
  { to: "/admin/dms", label: "Media", icon: "🖼" },
  { to: "/admin/referrals", label: "Referrals", icon: "⚙️" },
  { to: "/admin/site-settings", label: "Settings", icon: "🛠" },
  { to: "/admin/notifications", label: "Announce", icon: "📢" },
  { to: "/admin/logs", label: "Logs", icon: "📋" },
  { to: "/admin/system-health", label: "Health", icon: "🏥" },
];

export default function AdminBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  // Filter more items by role
  const filteredMoreItems = moreItems.filter(item => {
    const r = user?.role;
    if (r === "master" || r === "owner") return true;
    if (["finance_admin", "admin"].includes(r)) return ["/admin/users", "/admin/deposit-history", "/admin/notifications"].includes(item.to);
    return false;
  });

  const isActiveItem = (item) => {
    if (item.end) return location.pathname === item.to;
    return location.pathname.startsWith(item.to);
  };

  // Check if a "more" item is currently active
  const moreIsActive = filteredMoreItems.some(item => location.pathname.startsWith(item.to));

  const handleMoreItemClick = (to) => {
    setMoreOpen(false);
    navigate(to);
  };

  return (
    <>
      <nav className="admin-bottom-nav">
        {primaryItems.map((item) => {
          const active = isActiveItem(item);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={`admin-bottom-nav__item ${active ? "is-active" : ""}`}
            >
              <span className="admin-bottom-nav__icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          );
        })}
        
        {/* More button */}
        <button
          className={`admin-bottom-nav__item ${moreIsActive ? "is-active" : ""}`}
          onClick={() => setMoreOpen(true)}
          aria-label="More admin tools"
        >
          <span className="admin-bottom-nav__icon">☰</span>
          <span>More</span>
        </button>
      </nav>

      {/* More bottom sheet overlay */}
      <div 
        className={`admin-more-overlay ${moreOpen ? "is-open" : ""}`}
        onClick={() => setMoreOpen(false)}
      >
        <div className="admin-more-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="admin-more-sheet__handle" />
          <div className="admin-more-sheet__title">Admin Tools</div>
          <div className="admin-more-sheet__grid">
            {filteredMoreItems.map((item) => (
              <button 
                key={item.to}
                className="admin-more-sheet__item"
                onClick={() => handleMoreItemClick(item.to)}
                style={
                  location.pathname.startsWith(item.to) 
                    ? { background: "rgba(10, 81, 225, 0.08)", borderColor: "var(--primary)" }
                    : undefined
                }
              >
                <span className="admin-more-sheet__item-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Exit Admin link */}
          <button
            className="admin-more-sheet__item"
            onClick={() => { setMoreOpen(false); navigate("/"); }}
            style={{ 
              width: "100%", 
              marginTop: "12px", 
              background: "rgba(239,68,68,0.06)",
              borderColor: "rgba(239,68,68,0.15)",
              color: "#ef4444",
              flexDirection: "row",
              gap: "8px",
              justifyContent: "center"
            }}
          >
            <span>🚪</span>
            <span>Exit Admin Panel</span>
          </button>
        </div>
      </div>
    </>
  );
}
