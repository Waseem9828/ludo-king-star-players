import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import Modal from "../components/Modal.jsx";
import InstallPwaBanner from "../components/InstallPwaBanner.jsx";
import BannerSlider from "../components/BannerSlider.jsx";
import { apiRequest } from "../lib/apiClient.js";
import useSWR from "swr";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getWhatsappLink } from "../lib/whatsapp.js";
import LandingPage from "./LandingPage.jsx";
import "./Home.css";

const RULES_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
);

const ALERT_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
);

const DEFAULT_NOTICE = "🏆 Welcome to ludo King adda .com! Challenge real players in 1v1 Ludo battles & get instant UPI withdrawals 24/7.";
const DEFAULT_CARD_IMAGE = "/file_000000002fb082088c0616723d18eb5b.png";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [noticeText, setNoticeText] = useState(DEFAULT_NOTICE);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [card1Image, setCard1Image] = useState(DEFAULT_CARD_IMAGE);
  const [card2Image, setCard2Image] = useState(DEFAULT_CARD_IMAGE);
  
  const { data: kycData } = useSWR(isAuthenticated ? "/kyc/me" : null);
  const kycStatus = kycData?.status || "none";

  useEffect(() => {
    const fetchSettings = () => {
      apiRequest("/settings")
        .then((data) => {
          if (data) {
            if (data.homeNoticeText && data.homeNoticeText.trim()) {
              setNoticeText(data.homeNoticeText);
            }
            if (data.supportWhatsapp) {
              setWhatsappNumber(data.supportWhatsapp);
            }
            if (data.gameCardImage1 && data.gameCardImage1.trim()) {
              setCard1Image(data.gameCardImage1.trim());
            }
            if (data.gameCardImage2 && data.gameCardImage2.trim()) {
              setCard2Image(data.gameCardImage2.trim());
            }
          }
        })
        .catch(() => setNoticeText(DEFAULT_NOTICE));
    };

    fetchSettings();

    window.addEventListener("app:refresh", fetchSettings);
    return () => window.removeEventListener("app:refresh", fetchSettings);
  }, []);

  // Show landing page for unauthenticated users
  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <div className="home-container">
      <InstallPwaBanner />
      
      {isAuthenticated && kycStatus !== "verified" && (
        <Link to="/kyc" style={{ textDecoration: "none" }}>
          <div className="notice-banner row-between" style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #f87171", margin: "10px 16px 0", borderRadius: "8px", fontWeight: "bold" }}>
            <span>⚠️ KYC is required for withdrawals. Click to complete.</span>
            <span>→</span>
          </div>
        </Link>
      )}

      {/* HOMEPAGE BANNER SLIDER */}
      <BannerSlider />

      {/* Notice Banner */}
      <div className="home-notice">
        <div className="home-notice-icon">
          {ALERT_ICON}
        </div>
        <div className="home-notice-text">
          <span className="home-notice-title">Notice:-</span>{' '}
          {noticeText}
        </div>
      </div>

      {/* Select Game Section Header */}
      <div className="home-select-header">
        <div className="home-select-title">SELECT GAME</div>
        <div className="home-select-line"></div>
        <button onClick={() => setIsRulesOpen(true)} className="home-rules-btn" style={{ border: 'none', cursor: 'pointer' }}>
          {RULES_ICON} RULES
        </button>
      </div>

      {/* Game Cards Grid - 2 Same Size Cards in 1 Line */}
      <div className="home-games-grid">
        <Link to="/match-room" className="home-game-card">
          <img src={card1Image} alt="Ludo Game 1" onError={(e) => { e.target.src = DEFAULT_CARD_IMAGE; }} />
        </Link>
        <Link to="/match-room" className="home-game-card">
          <img src={card2Image} alt="Ludo Game 2" onError={(e) => { e.target.src = DEFAULT_CARD_IMAGE; }} />
        </Link>
      </div>

      {/* Developer Credit & Copyright */}
      <div className="home-footer-credit">
        <div>Developed by Waseem Akram (Sadaf Soft Tech)</div>
        <div>&copy; {new Date().getFullYear()} ludo King adda .com. All Rights Reserved.</div>
      </div>
      
      {/* WhatsApp FAB */}
      {whatsappNumber && (
        <a
          href={getWhatsappLink(whatsappNumber, "Hi, I need help with ludo King adda .com.")}
          className="home-whatsapp-fab"
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className="home-whatsapp-pulse"></div>
          <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" width="40" height="40" />
        </a>
      )}

      {/* Rules Bottom Sheet */}
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
    </div>
  );
}
