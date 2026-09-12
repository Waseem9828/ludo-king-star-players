import { useState } from "react";
import useSWR from "swr";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Loading from "../components/Loading.jsx";
import { getReferral } from "../lib/referralApi.js";
import { friendlyError } from "../lib/errors.js";
import "./Referral.css";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function Referral() {
  const { token, isAuthenticated, initializing } = useAuth();
  const navigate = useNavigate();

  const { data: rawData, error: swrError, mutate } = useSWR(isAuthenticated ? "/referral" : null);

  const loading = !rawData && !swrError;
  const error = swrError ? friendlyError(swrError) : "";
  const [copied, setCopied] = useState("");
  const [contacts, setContacts] = useState([]);

  if (initializing) {
    return <Loading label="Loading..." />;
  }

  const data = isAuthenticated ? rawData : { totalReferrals: 0, totalEarned: 0, code: "LOGIN_TO_GET_CODE", referrals: [] };


  const referralLink = data ? `${window.location.origin}/login?ref=${data.code}` : "";

  const flashCopied = (label) => {
    setCopied(label);
    setTimeout(() => setCopied(""), 1500);
  };

  const handleCopyCode = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.code);
      flashCopied("code");
    } catch {
      // Clipboard access unavailable — ignore silently.
    }
  };

  const handleCopyLink = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      flashCopied("link");
    } catch {
      // Clipboard access unavailable — ignore silently.
    }
  };

  const handleNativeShare = async () => {
    if (!data) return false;
    const shareText = `🎮 Join me on ludo King adda .com! Use my referral code ${data.code} to play Ludo & win real cash: ${referralLink}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "ludo King adda .com",
          text: shareText,
          url: referralLink,
        });
        return true;
      } catch {
        // Fallback to direct app URL opening
      }
    }
    return false;
  };

  const handleWhatsAppShare = async () => {
    if (!data) return;
    const shared = await handleNativeShare();
    if (!shared) {
      const text = encodeURIComponent(
        `🎮 Join me on ludo King adda .com! Use my referral code ${data.code} to play Ludo & win real cash: ${referralLink}`
      );
      window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
    }
  };

  const handleTelegramShare = async () => {
    if (!data) return;
    const shared = await handleNativeShare();
    if (!shared) {
      const text = encodeURIComponent(
        `🎮 Join me on ludo King adda .com! Use my referral code ${data.code} to play Ludo & win real cash: ${referralLink}`
      );
      window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${text}`, "_blank", "noopener,noreferrer");
    }
  };

  const handleLoadContacts = async () => {
    if (!("contacts" in navigator && "ContactsManager" in window)) {
      alert("Fetching contacts is not supported on your current browser/device. Try using Chrome on Android.");
      return;
    }
    try {
      const props = ["name", "tel"];
      const opts = { multiple: true };
      const selectedContacts = await navigator.contacts.select(props, opts);
      if (selectedContacts && selectedContacts.length > 0) {
        
        // Send to backend to save and filter out already registered users
        const res = await fetch("/api/referral/contacts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ contacts: selectedContacts })
        });
        
        if (!res.ok) {
          throw new Error("Failed to sync contacts");
        }
        
        const data = await res.json();
        
        // Show only the unregistered ones to the user
        if (data.unregisteredContacts && data.unregisteredContacts.length > 0) {
          setContacts(data.unregisteredContacts);
        } else {
          alert("All selected contacts are already registered on the platform!");
          setContacts([]);
        }
      }
    } catch (ex) {
      console.error("Failed to fetch contacts", ex);
    }
  };

  return (
    <div className="referral-page">
      {error && (
        <p className="notice-banner row-between" style={{ marginBottom: "1rem" }}>
          <span>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => mutate()}>
            Retry
          </button>
        </p>
      )}

      {loading ? (
        <Loading label="Loading referral info..." />
      ) : (
        data && (
          <div className="referral-stack">
            {/* 1. Your Referral Earnings */}
            <div className="ref-card">
              <div className="ref-card-header">Your Referral Earnings</div>
              <div className="ref-card-body ref-earnings-grid">
                <div className="ref-stat">
                  <div className="ref-stat-label">Referred Friends</div>
                  <div className="ref-stat-value">{data.totalReferrals} Friends</div>
                </div>
                <div className="ref-stat-divider"></div>
                <div className="ref-stat">
                  <div className="ref-stat-label">Referral Earning</div>
                  <div className="ref-stat-value">🪙{data.totalEarned.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* 2. Referral Code */}
            <div className="ref-card">
              <div className="ref-card-header">Referral Code</div>
              <div className="ref-card-body ref-code-section">
                <img 
                  src="/referral-illustration.png" 
                  alt="Refer A Friend" 
                  className="ref-illustration" 
                />

                <div className="ref-input-group">
                  <input 
                    type="text" 
                    value={data.code} 
                    readOnly 
                    className="ref-input" 
                  />
                  <button className="btn ref-copy-btn" onClick={handleCopyCode}>
                    {copied === "code" ? "COPIED" : "COPY"}
                  </button>
                </div>

                <div className="ref-or">OR</div>

                <div className="ref-actions">
                  <button className="btn ref-btn-wa" onClick={handleWhatsAppShare}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"></path><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"></path></svg>
                    Share To Whatsapp
                  </button>
                  <button className="btn ref-btn-tg" onClick={handleTelegramShare}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    Share To Telegram
                  </button>
                  <button className="btn ref-btn-clip" onClick={handleCopyLink}>
                    {copied === "link" ? "Copied To Clipboard!" : "Copy To Clipboard"}
                  </button>
                </div>
              </div>
            </div>

            {/* 3. How It Works */}
            <div className="ref-card">
              <div className="ref-card-header">How It Works</div>
              <div className="ref-card-body ref-how-section">
                <div className="ref-how-box">
                  You can refer and <strong>Earn Commission</strong> on the platform fee every time your referral wins!
                </div>
                <div className="ref-how-box">
                  Your commission is credited directly to your <strong>Deposit Balance</strong> and can be used to play matches.
                </div>
              </div>
            </div>

            {/* Share to Contacts */}
            <div className="ref-card">
              <div className="ref-card-header">Invite Phone Contacts</div>
              <div className="ref-card-body stack" style={{ gap: "12px" }}>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                  Select contacts from your phone to easily share your referral link via WhatsApp.
                </p>
                <button className="btn btn-primary" onClick={handleLoadContacts}>
                  📚 Choose Contacts from Phone
                </button>

                {contacts.length > 0 && (
                  <div className="ref-list" style={{ marginTop: "8px" }}>
                    {contacts.map((c, i) => {
                      const name = c.name?.[0] || "Unknown Contact";
                      const tel = c.tel?.[0];
                      if (!tel) return null;
                      const cleanTel = tel.replace(/\D/g, '');
                      const text = encodeURIComponent(
                        `Join me on ludo King adda .com! Use my referral code ${data.code} to sign up: ${referralLink}`
                      );
                      const waLink = `https://wa.me/${cleanTel}?text=${text}`;

                      return (
                        <div key={i} className="ref-list-item row-between">
                          <span className="ref-list-name" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                          <a 
                            href={waLink} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="btn btn-sm" 
                            style={{ background: "#25D366", color: "white", padding: "4px 12px", border: "none" }}
                          >
                            <img src="/icon-192.png" alt="App Logo" style={{ width: "16px", height: "16px", borderRadius: "4px" }} />
                            Share
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Your Referrals List (Kept from old design) */}
            <div className="ref-card">
              <div className="ref-card-header">Your Referrals</div>
              <div className="ref-card-body">
                {data.referrals.length === 0 ? (
                  <EmptyState type="referral" />
                ) : (
                  <div className="ref-list">
                    {data.referrals.map((r, i) => (
                      <div key={i} className="ref-list-item">
                        <span className="ref-list-name">{r.name}</span>
                        <span className="ref-list-meta">
                          +🪙{r.rewardCoins} · {formatDate(r.joinedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        )
      )}
    </div>
  );
}
