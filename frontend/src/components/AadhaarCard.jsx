import { useState } from "react";
import "../pages/Kyc.css";

const UIDAI_LOGO_URL = "https://upload.wikimedia.org/wikipedia/en/c/cf/Aadhaar_Logo.svg";

export default function AadhaarCard({ kyc, user }) {
  const [showFullAadhaar, setShowFullAadhaar] = useState(false);

  const name = kyc?.name || user?.name || "Card Holder";
  const aadhaarNumber = kyc?.aadhaarNumber || "";
  const dob = kyc?.dob || "";
  const gender = kyc?.gender || "";
  const phone = user?.phone || "";

  // Dynamic UIDAI Aadhaar QR payload encoding user details
  const qrPayload = `<?xml version="1.0" encoding="UTF-8"?><PrintLetterBarcodeData uid="${aadhaarNumber}" name="${name}" gender="${gender}" dob="${dob}" phone="${phone}"/>`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=1&data=${encodeURIComponent(qrPayload)}`;

  const formatAadhaarDisplay = (num) => {
    if (!num) return "—";
    if (showFullAadhaar) {
      return `${num.slice(0, 4)} ${num.slice(4, 8)} ${num.slice(8, 12)}`;
    }
    return `XXXX XXXX ${num.slice(-4)}`;
  };

  return (
    <div className="aadhaar-card" style={{ margin: 0 }}>
      {/* Header Banner */}
      <div className="aadhaar-header">
        <div className="aadhaar-header-inner">
          <div className="aadhaar-emblem-wrap" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <img src={UIDAI_LOGO_URL} alt="UIDAI Logo" style={{ height: "34px", width: "auto", objectFit: "contain" }} />
          </div>
          <div className="aadhaar-title-group">
            <p className="aadhaar-title-hindi">भारत सरकार</p>
            <p className="aadhaar-title-eng">Government of India</p>
          </div>
        </div>
      </div>

      {/* Card Body: Photo | Details | Vertically Centered QR Code (No Container) */}
      <div className="aadhaar-body">
        {/* Left: User Photo */}
        <div className="aadhaar-photo-box">
          {kyc?.aadhaarImageUrl ? (
            <img src={kyc.aadhaarImageUrl} alt="Aadhaar photo" className="aadhaar-photo-img" />
          ) : (
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
              <circle cx="12" cy="8" r="4" />
              <path d="M5 20c0-4 3-7 7-7s7 3 7 7" />
            </svg>
          )}
        </div>

        {/* Center: User Details */}
        <div className="aadhaar-details">
          <div>
            <p className="aadhaar-field-label">Name / नाम</p>
            <p className="aadhaar-field-value">{name}</p>
          </div>
          {dob && (
            <div>
              <p className="aadhaar-field-label">DOB / जन्म तिथि</p>
              <p className="aadhaar-field-value" style={{ fontSize: "11.5px" }}>{dob}</p>
            </div>
          )}
          {gender && (
            <div>
              <p className="aadhaar-field-label">Gender / लिंग</p>
              <p className="aadhaar-field-value" style={{ fontSize: "11.5px" }}>{gender}</p>
            </div>
          )}
          <div>
            <p className="aadhaar-field-label">Mobile / मोबाइल</p>
            <p className="aadhaar-field-value" style={{ fontSize: "11.5px" }}>{phone || "—"}</p>
          </div>
        </div>

        {/* Right: QR Code (No Container, Aligned Right, Vertically Centered) */}
        <div className="aadhaar-qr-box">
          <img
            src={qrCodeUrl}
            alt="Aadhaar QR Code"
            className="aadhaar-qr-img"
          />
        </div>
      </div>

      {/* Address without container */}
      {kyc?.address && (
        <div className="aadhaar-address-section">
          <p className="aadhaar-field-label" style={{ marginBottom: "2px" }}>Address / पता</p>
          <p className="aadhaar-address-text">
            {kyc.address} {kyc.pincode ? `- ${kyc.pincode}` : ""}
          </p>
        </div>
      )}

      {/* Aadhaar Number Row without container (like real Aadhaar) */}
      <div className="aadhaar-number-row">
        <div style={{ flex: 1, textAlign: "center" }}>
          <p className="aadhaar-number-text">{formatAadhaarDisplay(aadhaarNumber)}</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ fontSize: "11px", color: "#475569", padding: "2px 6px", height: "auto" }}
          onClick={() => setShowFullAadhaar(!showFullAadhaar)}
        >
          {showFullAadhaar ? "🔒 Mask" : "👁 Show"}
        </button>
      </div>

      {/* Footer */}
      <div className="aadhaar-footer">
        <p className="aadhaar-motto">मेरा आधार, मेरी पहचान</p>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ fontSize: "9.5px", color: "#64748b", fontWeight: "bold" }}>Aadhaar copyright</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
      </div>
    </div>
  );
}
