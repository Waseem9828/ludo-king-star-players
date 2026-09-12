import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { useAuth } from "../contexts/AuthContext.jsx";
import { MenuIcon, ShieldIcon } from "./Icons.jsx";
import Modal from "./Modal.jsx";
import "./Header.css";

const BellIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const WalletIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path></svg>
);

export default function Header({ onMenuClick }) {
  const { isAuthenticated, wallet, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  // Dynamic PWA install & Standalone detection
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true)
  );

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const { data: siteSettings } = useSWR("/settings");

  const handleInstallOrDownload = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        setIsInstalled(true);
      }
    } else {
      const customApk = siteSettings?.appApkUrl || siteSettings?.apkUrl;
      if (customApk) {
        const link = document.createElement("a");
        link.href = customApk;
        link.target = "_blank";
        link.download = "LudoKingAdda.apk";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      // If no APK file configured, guide PWA App installation directly
      const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        toast("To install app on iPhone/iPad: Tap Share icon ⎕↑ and select 'Add to Home Screen'", { icon: "📲", duration: 6000 });
      } else {
        toast("To install app: Open browser menu (⋮) and tap 'Install App' or 'Add to Home Screen'", { icon: "📲", duration: 6000 });
      }
    }
  };

  const { data: unreadData } = useSWR(isAuthenticated ? "/notifications/unread-count" : null, {
    refreshInterval: 6000,
  });
  const unreadCount = unreadData?.count || 0;

  return (
    <header className="app-header">
      <div className="app-header__left">
        <button className="icon-btn app-header__menu" onClick={onMenuClick} aria-label="Open menu">
          <MenuIcon size={24} />
        </button>

        <Link to="/" className="app-header__brand">
          <img 
            src="/header.png" 
            alt="ludo King adda .com Logo" 
            className="app-header__logo-img" 
          />
        </Link>
      </div>

      <div className="app-header__right">
        {/* Show Download/Install button IF NOT installed on user's phone */}
        {!isInstalled && (
          <button
            id="header-download-btn"
            className="header-download-btn"
            onClick={handleInstallOrDownload}
            aria-label="Install App"
            title="Install App"
            style={{ border: "none", cursor: "pointer", padding: 0 }}
          >
            <img src="/download.png" alt="Download" className="header-download-icon" />
          </button>
        )}

        {isAuthenticated ? (
          <>
            <Link to="/notifications" className="app-header__bell-btn" aria-label="Notifications">
              <BellIcon />
              {unreadCount > 0 && (
                <span className="header-bell-badge">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>

            <Link to="/wallet" className="app-header__wallet-btn" aria-label="Wallet balance">
              <WalletIcon />
              <span>₹{wallet ? wallet.totalCoins.toLocaleString() : "0"}</span>
            </Link>
          </>
        ) : (
          <button
            id="header-rules-btn"
            className="header-rules-btn"
            onClick={() => setIsRulesOpen(true)}
          >
            📋 Rules
          </button>
        )}
      </div>

      {/* Rules Bottom Sheet (for guests) */}
      <Modal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} title="🎲 Ludo Classic Rules" variant="bottom-sheet">
        <div style={{ maxHeight: '50vh', overflowY: 'auto', paddingRight: '4px', fontSize: '13px', lineHeight: '1.6' }}>
          <p><strong>Players:</strong> 2 players in 1v1 match mode.</p>
          <p><strong>Objective:</strong> Move all 4 tokens from your starting yard to your home/finish area before your opponent.</p>
          <p><strong>Starting a token:</strong> A token leaves the yard when you roll a 6.</p>
          <p><strong>Movement:</strong> Move a token exactly the number shown on the dice.</p>
          <p><strong>Rolling a 6:</strong> Rolling a 6 gives you an additional dice roll.</p>
          <p><strong>Capturing:</strong> Landing on an opponent's token on a non-safe square sends it back to yard.</p>
          <p><strong>Safe Squares:</strong> Star-marked squares are safe; tokens cannot be captured on safe squares.</p>
          <p><strong>Winning & Prize:</strong> The first player to bring all 4 tokens home wins the cash prize instantly credited to winning wallet.</p>
        </div>
      </Modal>
    </header>
  );
}
