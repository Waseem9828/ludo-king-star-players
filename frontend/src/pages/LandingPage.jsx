import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiRequest } from "../lib/apiClient.js";
import { getWhatsappLink } from "../lib/whatsapp.js";
import "./LandingPage.css";

export default function LandingPage() {
  const navigate = useNavigate();
  const [whatsappNumber, setWhatsappNumber] = useState("");

  useEffect(() => {
    apiRequest("/settings")
      .then((data) => {
        if (data?.supportWhatsapp) {
          setWhatsappNumber(data.supportWhatsapp);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="landing-page">
      {/* Top App Branding Badge */}
      <div className="landing-header">
        <div className="landing-brand-logo">
          <img src="/header.png" alt="App Logo" className="landing-logo-img" onError={(e) => { e.target.style.display = "none"; }} />
          <span className="landing-brand-name">ludo King adda .com</span>
        </div>
        <span className="landing-live-badge">
          <span className="landing-live-dot" /> 24/7 BATTLES
        </span>
      </div>

      {/* Hero Section: Animated Dice & Glow */}
      <div className="landing-hero-section">
        <div className="landing-dice-bg-glow" />
        <div className="landing-dice-wrapper">
          <img
            src="/dice_gif.gif"
            alt="Dice rolling animation"
            className="landing-dice-gif"
          />
        </div>
        <h2 className="landing-hero-title">1v1 Real Money Ludo Battles</h2>
        <p className="landing-hero-subtitle">Play with real players & get instant UPI withdrawals 24/7</p>
      </div>

      {/* Disclaimer Card Container */}
      <div className="landing-disclaimer-card">
        <div className="landing-disclaimer-header">
          <span>⚠️ RESPONSIBLE GAMING ADVISORY</span>
        </div>
        <p className="landing-disclaimer-text">
          This Game involves an element of financial risk and may be addictive. Please play responsibly and at your own risk. Only 18+ allowed.
        </p>
      </div>

      {/* CTA Bottom Action Row */}
      <div className="landing-cta-row">
        <button
          id="landing-play-now-btn"
          className="landing-play-btn"
          onClick={() => navigate("/login")}
        >
          <span>PLAY NOW</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </button>

        {whatsappNumber && (
          <a
            id="landing-whatsapp-btn"
            href={getWhatsappLink(whatsappNumber, "Hi, I need help with ludo King adda .com.")}
            className="landing-whatsapp-btn"
            target="_blank"
            rel="noopener noreferrer"
            title="WhatsApp Support"
          >
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
              alt="WhatsApp Support"
              width="26"
              height="26"
            />
          </a>
        )}
      </div>
    </div>
  );
}
