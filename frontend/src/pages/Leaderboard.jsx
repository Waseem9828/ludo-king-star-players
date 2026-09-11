import useSWR from "swr";
import Loading from "../components/Loading.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { UserIcon } from "../components/Icons.jsx";
import "../components/BattleCard.css";
import "./Leaderboard.css";

export default function Leaderboard() {
  const { data: leaderboardData, error, mutate } = useSWR("/leaderboard");
  const { data: siteSettings } = useSWR("/settings");

  const loading = !leaderboardData && !error;
  const bannerImage = siteSettings?.leaderboardBannerImage;

  const getRankBadgeClass = (rank) => {
    if (rank === 1) return "rank-badge-gold";
    if (rank === 2) return "rank-badge-silver";
    if (rank === 3) return "rank-badge-bronze";
    return "rank-badge-blue";
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return "🏆 #1";
    if (rank === 2) return "🥈 #2";
    if (rank === 3) return "🥉 #3";
    return `#${rank}`;
  };

  const getDisplayName = (name) => {
    if (!name || typeof name !== "string") return "Player";
    const trimmed = name.trim();
    return trimmed.length > 0 ? trimmed : "Player";
  };

  return (
    <div className="leaderboard-container">
      {/* 1. TOP BANNER (Dynamic Height based on Image, Fallback Blue & White Theme Card) */}
      {bannerImage ? (
        <div className="leaderboard-image-banner-wrap">
          <img
            src={bannerImage}
            alt="Leaderboard Banner"
            className="leaderboard-image-banner"
          />
        </div>
      ) : (
        <div className="leaderboard-theme-banner">
          <div className="leaderboard-banner-content">
            <h1 className="leaderboard-title">🏆 Mewat Play Leaderboard</h1>
            <p className="leaderboard-subtitle">
              Top Players Ranked by Battle Winnings & Referred Friends
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="notice-banner row-between" style={{ marginBottom: "12px" }}>
          <span>Failed to load leaderboard rankings.</span>
          <button className="btn btn-ghost btn-sm" onClick={() => mutate()}>
            Retry
          </button>
        </div>
      )}

      {/* 2. HEADER COLUMNS BAR */}
      <div className="leaderboard-columns-header">
        <div className="col-rank">Rank</div>
        <div className="col-player">Player</div>
        <div className="col-winnings">Winnings</div>
        <div className="col-referrals">Friends</div>
      </div>

      {/* 3. LEADERBOARD CARDS LIST */}
      {loading ? (
        <Loading label="Loading top player rankings..." />
      ) : !leaderboardData || leaderboardData.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="🏆"
            title="No Rankings Yet"
            description="Play Ludo battles and invite friends to claim top positions on the leaderboard!"
          />
        </div>
      ) : (
        <div className="leaderboard-list">
          {leaderboardData.map((row) => (
            <div key={row.userId || row.rank} className="battle-card-metal leaderboard-white-card">
              {/* Col 1: Rank Badge */}
              <div className="col-rank">
                <div className={`rank-badge ${getRankBadgeClass(row.rank)}`}>
                  {getRankIcon(row.rank)}
                </div>
              </div>

              {/* Col 2: Player Avatar & Name */}
              <div className="col-player flex-align">
                <div className="battle-card-avatar leaderboard-avatar">
                  <img src="/logo.png" alt="Avatar" className="battle-card-avatar-img" />
                </div>
                <div className="leaderboard-player-info">
                  <span className="leaderboard-player-name" title={getDisplayName(row.name)}>
                    {getDisplayName(row.name)}
                  </span>
                  <span className="leaderboard-player-battles">
                    {row.rank <= 3 ? "🌟 Champion" : `Won: ${row.battlesWon || 0}`}
                  </span>
                </div>
              </div>

              {/* Col 3: Total Winnings */}
              <div className="col-winnings">
                <span className="stat-winnings-val">🪙 ₹{Number(row.totalWinnings || 0).toLocaleString()}</span>
              </div>

              {/* Col 4: Referred Friends */}
              <div className="col-referrals">
                <span className="stat-referrals-val">👥 {row.totalReferrals || 0}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
