import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header.jsx";
import Sidebar from "./Sidebar.jsx";
import NewsTicker from "./NewsTicker.jsx";
import PullToRefresh from "./PullToRefresh.jsx";
import "./AppLayout.css";

export default function AppLayout() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Long pages that require scrolling: Leaderboard, Match Room, History, Admin
  const scrollableRoutes = ["/leaderboard", "/match-room", "/history", "/admin"];
  const isScrollable = scrollableRoutes.some((route) => location.pathname.startsWith(route));

  return (
    <div className="desktop-layout">
      {/* Phone App Container Mockup */}
      <div className="mobile-app-container">
        <div className="app-shell">
          <NewsTicker />
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <PullToRefresh>
            <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
            <main className={`app-content ${isScrollable ? "is-scrollable" : "is-sticky"}`}>
              <div className="container">
                <Outlet />
              </div>
            </main>
          </PullToRefresh>
        </div>
      </div>
      
      {/* Laptop / Desktop Animated Promo Screen */}
      <div className="desktop-promo-container">
        <div className="desktop-promo-card">
          <div className="desktop-promo-header">
            <div className="desktop-promo-logo-wrapper">
              <img src="/header.png" alt="ludo King adda .com Logo" className="desktop-promo-logo" />
            </div>
            <span className="live-badge">
              <span className="pulse-dot"></span> LIVE 24/7 BATTLES
            </span>
          </div>

          <h1 className="desktop-promo-title">Play Ludo & Win Real Cash Daily!</h1>
          <p className="desktop-promo-desc">
            India's premier skill-based Ludo platform. Challenge real players in live 1v1 matches, get instant UPI withdrawals 24/7, and earn lifetime referral rewards!
          </p>

          <div className="desktop-promo-stats">
            <div className="promo-stat-box">
              <span className="stat-number">⚡ 10K+</span>
              <span className="stat-label">Daily Battles</span>
            </div>
            <div className="promo-stat-box">
              <span className="stat-number">⏱️ Instant</span>
              <span className="stat-label">UPI Payouts</span>
            </div>
            <div className="promo-stat-box">
              <span className="stat-number">🛡️ 100%</span>
              <span className="stat-label">Fair & Safe</span>
            </div>
          </div>

          <div className="desktop-promo-features">
            <div className="promo-feature-badge">
              <span className="feature-icon">🎲</span>
              <div>
                <strong>Custom Room Code</strong>
                <p className="feature-sub">Instant auto room code sharing</p>
              </div>
            </div>
            <div className="promo-feature-badge">
              <span className="feature-icon">💸</span>
              <div>
                <strong>Zero Wait Payouts</strong>
                <p className="feature-sub">Direct to UPI & Bank Account</p>
              </div>
            </div>
            <div className="promo-feature-badge">
              <span className="feature-icon">👑</span>
              <div>
                <strong>Daily Leaderboard</strong>
                <p className="feature-sub">Top players win extra bonus chips</p>
              </div>
            </div>
            <div className="promo-feature-badge">
              <span className="feature-icon">👥</span>
              <div>
                <strong>Lifetime Referrals</strong>
                <p className="feature-sub">Earn commission on every match</p>
              </div>
            </div>
          </div>

          <div className="desktop-promo-footer">
            <div className="qr-badge">
              <span className="qr-text">📱 Best experienced on Mobile Phone</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


