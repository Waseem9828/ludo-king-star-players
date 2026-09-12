import { useState } from "react";
import "./EmptyState.css";

const DEFAULT_BRAND_LOGO = "/header.png";

const PRESET_CONFIGS = {
  // 1. GAME HISTORY / BATTLES
  game: {
    title: "No game history yet",
    description: "Battles you play will show up here.",
    image: "/images/empty_games.png",
    fallbackIcon: "🎲",
    badgeLabel: "ludo King adda .com · Battle Arena",
  },
  games: {
    title: "No game history yet",
    description: "Battles you play will show up here.",
    image: "/images/empty_games.png",
    fallbackIcon: "🎲",
    badgeLabel: "ludo King adda .com · Battle Arena",
  },

  // 2. WITHDRAWALS
  withdraw: {
    title: "No withdrawals yet",
    description: "Withdrawal requests will show up here.",
    image: "/images/empty_withdraw.png",
    fallbackIcon: "💸",
    badgeLabel: "ludo King adda .com · Payout Requests",
  },
  withdrawals: {
    title: "No withdrawals yet",
    description: "Withdrawal requests will show up here.",
    image: "/images/empty_withdraw.png",
    fallbackIcon: "💸",
    badgeLabel: "ludo King adda .com · Payout Requests",
  },

  // 3. DEPOSITS
  deposit: {
    title: "No deposits yet",
    description: "Virtual coin top-ups will show up here.",
    image: "/images/empty_deposit.png",
    fallbackIcon: "🪙",
    badgeLabel: "ludo King adda .com · Wallet Top-Ups",
  },
  deposits: {
    title: "No deposits yet",
    description: "Virtual coin top-ups will show up here.",
    image: "/images/empty_deposit.png",
    fallbackIcon: "🪙",
    badgeLabel: "ludo King adda .com · Wallet Top-Ups",
  },

  // 4. REFERRALS
  referral: {
    title: "No referral history yet",
    description: "Referral bonuses will show up here.",
    image: "/images/empty_referral.png",
    fallbackIcon: "🎁",
    badgeLabel: "ludo King adda .com · Referral Rewards",
  },
  referrals: {
    title: "No referral history yet",
    description: "Referral bonuses will show up here.",
    image: "/images/empty_referral.png",
    fallbackIcon: "🎁",
    badgeLabel: "ludo King adda .com · Referral Rewards",
  },
};

export default function EmptyState({
  type,
  icon,
  image,
  title,
  description,
  actionLabel,
  onAction,
  showBrand = true,
}) {
  const preset = (type && PRESET_CONFIGS[type.toLowerCase()]) || null;

  const displayTitle = title || (preset && preset.title) || "No records found";
  const displayDesc = description || (preset && preset.description) || "";
  const displayImage = image || (preset && preset.image) || null;
  const displayIcon = icon || (preset && preset.fallbackIcon) || "🎲";
  const badgeText = (preset && preset.badgeLabel) || "ludo King adda .com";

  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="empty-state">
      {/* App Name Brand Badge */}
      {showBrand && (
        <div className="empty-state__brand-badge">
          <img
            src={DEFAULT_BRAND_LOGO}
            alt="App Badge"
            className="empty-state__brand-icon"
            onError={(e) => { e.target.style.display = "none"; }}
          />
          <span>{badgeText}</span>
        </div>
      )}

      {/* Illustration Card Frame */}
      <div className="empty-state__illustration-wrap">
        <div className="empty-state__glow-ring" />
        <div className="empty-state__image-box">
          {displayImage && !imageFailed ? (
            <img
              src={displayImage}
              alt={displayTitle}
              className="empty-state__img"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span className="empty-state__emoji-icon">{displayIcon}</span>
          )}
        </div>
      </div>

      {/* Title & Description */}
      <h3 className="empty-state__title">{displayTitle}</h3>
      {displayDesc && <p className="empty-state__description">{displayDesc}</p>}

      {/* Optional Action Button */}
      {actionLabel && (
        <button className="btn btn-primary btn-sm empty-state__action-btn" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
