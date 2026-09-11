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
      {/* Dice GIF */}
      <div className="landing-dice-wrapper">
        <img
          src="/dice_gif.gif"
          alt="Dice rolling animation"
          className="landing-dice-gif"
        />
      </div>

      {/* Disclaimer Text */}
      <div className="landing-disclaimer">
        <p>
          This Game involves an element of financial risk and may be addictive.
          Please Play responsibly and at your own risk.
        </p>
      </div>

      {/* CTA Row: PLAY NOW + WhatsApp Support */}
      <div className="landing-cta-row">
        <button
          id="landing-play-now-btn"
          className="landing-play-btn"
          onClick={() => navigate("/login")}
        >
          PLAY NOW
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
              width="28"
              height="28"
            />
          </a>
        )}
      </div>
    </div>
  );
}
