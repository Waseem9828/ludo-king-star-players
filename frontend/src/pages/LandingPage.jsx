import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiRequest } from "../lib/apiClient.js";
import { getWhatsappLink } from "../lib/whatsapp.js";
import "./LandingPage.css";

const DEFAULT_SUPPORT_WHATSAPP = "9828786246";

export default function LandingPage() {
  const navigate = useNavigate();
  const [whatsappNumber, setWhatsappNumber] = useState(DEFAULT_SUPPORT_WHATSAPP);

  useEffect(() => {
    apiRequest("/settings")
      .then((data) => {
        if (data?.supportWhatsapp) {
          setWhatsappNumber(data.supportWhatsapp);
        }
      })
      .catch(() => {});
  }, []);

  const whatsappHref = getWhatsappLink(
    whatsappNumber || DEFAULT_SUPPORT_WHATSAPP,
    "Hi, I need help with ludo King adda .com."
  );

  return (
    <div className="landing-page">
      {/* Hero Section: Big GIF Image Display */}
      <div className="landing-big-gif-section">
        <img
          src="/dice_gif.gif"
          alt="Ludo King Adda Gameplay"
          className="landing-big-gif"
        />
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

        <a
          id="landing-whatsapp-btn"
          href={whatsappHref}
          className="landing-whatsapp-btn"
          target="_blank"
          rel="noopener noreferrer"
          title="WhatsApp Support"
          aria-label="Contact WhatsApp Support"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#ffffff">
            <path d="M12.012 2c-5.506 0-9.989 4.478-9.989 9.984 0 1.758.459 3.474 1.33 4.982l-1.413 5.163 5.286-1.387c1.455.794 3.1 1.213 4.786 1.213h.004c5.505 0 9.988-4.478 9.988-9.984 0-2.668-1.039-5.176-2.926-7.062-1.887-1.886-4.396-2.929-7.066-2.929zm5.82 14.161c-.244.686-1.417 1.309-1.956 1.393-.538.084-1.243.12-3.565-.824-2.973-1.209-4.887-4.24-5.037-4.437-.149-.197-1.208-1.606-1.208-3.064 0-1.458.766-2.176 1.039-2.474.273-.298.596-.373.794-.373.198 0 .397.002.571.01.184.009.431-.07.674.514.248.596.844 2.062.918 2.211.074.149.124.323.025.522-.099.198-.149.323-.298.497-.149.174-.313.39-.447.522-.149.149-.304.312-.131.608.173.297.771 1.272 1.654 2.059 1.135 1.013 2.093 1.326 2.39 1.475.298.149.472.124.646-.074.174-.198.744-.868.943-1.166.198-.298.397-.248.67-.149.273.099 1.737.819 2.035.968.298.149.496.223.571.347.075.124.075 1.242-.169 1.928z"/>
          </svg>
        </a>
      </div>
    </div>
  );
}


