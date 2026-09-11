import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import Modal from "./Modal.jsx";
import { CloseIcon } from "./Icons.jsx";
import "./Sidebar.css";
import "../pages/Account.css";

const allNavigationLinks = [
  { to: "/match-room", label: "Play", authOnly: true },
  { to: "/wallet", label: "Wallet", authOnly: true },
  { to: "/account", label: "Profile", authOnly: true },
  { to: "/referral", label: "Refer & Earn", authOnly: true },
  { to: "/history", label: "History", authOnly: true },
  { to: "/leaderboard", label: "Leaderboard", authOnly: false },
  { to: "/support", label: "Help & Support", authOnly: false },
  { to: "/term-and-conditions", label: "Terms & Conditions", authOnly: false },
];

export default function Sidebar({ isOpen, onClose }) {
  const { user, isAuthenticated, logout, wallet } = useAuth();
  const navigate = useNavigate();
  const [isLogoutModalOpen, setLogoutModalOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setLogoutModalOpen(false);
    onClose?.();
    navigate("/login");
  };

  const visibleLinks = allNavigationLinks.filter(
    (link) => !link.authOnly || isAuthenticated
  );

  return (
    <>
      <div className={"sidebar-backdrop" + (isOpen ? " is-open" : "")} onClick={onClose} />
      <aside className={"sidebar" + (isOpen ? " is-open" : "")}>
        {/* App Name Banner */}
        <div className="sidebar-app-name">ludo King adda .com</div>

        <div className="sidebar-header">
          <div className="sidebar-user-info">
            <h2 className="sidebar-name">{isAuthenticated ? user?.name || "Player" : "Guest"}</h2>
          </div>
          <div className="sidebar-avatar">
            <img src="/logo.png" alt="App Logo" className="sidebar-avatar-img" />
          </div>
          <button className="icon-btn sidebar-close" onClick={onClose} aria-label="Close menu">
            <CloseIcon size={24} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {visibleLinks.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) => "sidebar-link" + (isActive ? " is-active" : "")}
            >
              <span className="sidebar-link-left">
                <span className="sidebar-label">{label}</span>
              </span>
              <span className="sidebar-chevron">›</span>
            </NavLink>
          ))}
        </nav>

        {isAuthenticated && (
          <button className="sidebar-logout" onClick={() => setLogoutModalOpen(true)}>
            <span>Logout</span>
          </button>
        )}

        {!isAuthenticated && (
          <button
            className="sidebar-login-btn"
            onClick={() => { onClose?.(); navigate("/login"); }}
          >
            Login / Register
          </button>
        )}
      </aside>

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
    </>
  );
}
