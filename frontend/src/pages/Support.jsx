import useSWR from "swr";
import { getWhatsappLink } from "../lib/whatsapp.js";
import "./Support.css";

export default function Support() {
  const { data: siteSettings } = useSWR("/settings");

  const whatsappVal = siteSettings?.supportWhatsapp || "https://wa.me/";
  const telegramVal = siteSettings?.supportTelegram || siteSettings?.telegramChannel || "https://t.me/";
  const facebookVal = siteSettings?.supportFacebook || "https://facebook.com/";
  const instagramVal = siteSettings?.supportInstagram || "https://instagram.com/";

  const openLink = (url) => {
    if (url) {
      window.open(url, "_blank");
    }
  };

  const openWhatsApp = () => {
    if (!whatsappVal) return;
    if (whatsappVal.startsWith("http://") || whatsappVal.startsWith("https://")) {
      window.open(whatsappVal, "_blank");
    } else {
      const url = getWhatsappLink(whatsappVal, "Hi, I need help with ludo King adda .com.");
      if (url) window.open(url, "_blank");
    }
  };

  return (
    <div className="support-page-container">
      <div className="support-stack">
        
        {/* CONTAINER 1: HEADING & DESCRIPTION CARD */}
        <div className="support-box-card">
          <div className="support-box-header">
            HELP & CUSTOMER SUPPORT
          </div>
          <div className="support-box-body text-center">
            <div className="support-live-badge">
              <span className="support-live-dot" />
              <span>24/7 Live Support Active</span>
            </div>
            <h1 className="support-main-heading">Customer Assistance</h1>
            <p className="support-description-text">
              Have questions regarding deposits, instant withdrawals, or match rules? Our dedicated support team is available 24/7 to assist you.
            </p>
          </div>
        </div>

        {/* CONTAINER 2: SUPPORT ILLUSTRATION IMAGE CARD */}
        <div className="support-box-card">
          <div className="support-box-header">
            SUPPORT ASSISTANCE
          </div>
          <div className="support-box-body image-box-body">
            <div className="support-image-frame">
              <img 
                src="/support.webp" 
                onError={(e) => { e.target.src = "/support.png"; }} 
                alt="Support Assistance" 
                className="support-banner-img" 
              />
            </div>
          </div>
        </div>

        {/* CONTAINER 3: CONTACT CHANNELS & ACTIONS CARD */}
        <div className="support-box-card">
          <div className="support-box-header">
            REACH OUT TO US
          </div>
          <div className="support-box-body">
            <div className="support-actions-stack">
              {/* 1. WhatsApp Button */}
              {whatsappVal && (
                <button
                  type="button"
                  onClick={openWhatsApp}
                  className="support-action-btn whatsapp-btn"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  <span>Contact on WhatsApp</span>
                </button>
              )}

              {/* 2. Telegram Button */}
              {telegramVal && (
                <button
                  type="button"
                  onClick={() => openLink(telegramVal)}
                  className="support-action-btn telegram-btn"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                    <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.56 8.16l-2.02 9.52c-.15.68-.55.85-1.12.53l-3.08-2.27-1.49 1.43c-.16.16-.3.3-.62.3l.22-3.13 5.71-5.16c.25-.22-.05-.34-.38-.12l-7.06 4.45-3.03-.95c-.66-.21-.67-.66.14-.98l11.84-4.56c.55-.2.1.04.89.94z"/>
                  </svg>
                  <span>Contact on Telegram</span>
                </button>
              )}

              {/* 3. Facebook Button */}
              {facebookVal && (
                <button
                  type="button"
                  onClick={() => openLink(facebookVal)}
                  className="support-action-btn facebook-btn"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  <span>Contact on Facebook</span>
                </button>
              )}

              {/* 4. Instagram Button */}
              {instagramVal && (
                <button
                  type="button"
                  onClick={() => openLink(instagramVal)}
                  className="support-action-btn instagram-btn"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                  <span>Contact on Instagram</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* CONTAINER 4: SUPPORT HIGHLIGHTS / RESPONSE TIME INFO CARD */}
        <div className="support-box-card">
          <div className="support-box-header">
            SUPPORT HIGHLIGHTS
          </div>
          <div className="support-box-body">
            <div className="support-highlights-grid">
              <div className="support-highlight-item">
                <span className="highlight-icon">⚡</span>
                <div className="highlight-content">
                  <strong>Fast Response</strong>
                  <span>Average reply time under 2 mins</span>
                </div>
              </div>
              <div className="support-highlight-item">
                <span className="highlight-icon">🛡️</span>
                <div className="highlight-content">
                  <strong>Secure Help</strong>
                  <span>100% Verified Customer Desk</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
