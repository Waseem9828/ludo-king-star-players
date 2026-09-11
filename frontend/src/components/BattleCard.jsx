import { UserIcon } from "./Icons.jsx";
import "./BattleCard.css";

export default function BattleCard({
  entryFee,
  prize,
  players = 1,
  maxPlayers = 2,
  status = "open",
  isOwn = false,
  isParticipant = false,
  isMock = false,
  creatorName,
  opponentName,
  onJoin,
  onCancel,
  onAccept,
  onView,
}) {
  const disabled = status === "full" && !isMock;
  const isOpenState = status === "open" || players === 1;

  const shortName = (name) => {
    if (!name) return "";
    return name.slice(0, 6) + (name.length > 6 ? ".." : "");
  };

  const canView = isParticipant || (isOpenState && !disabled);

  const handleCardClick = (e) => {
    if (canView && onView) onView(e);
  };

  return (
    <div
      className={`battle-card-metal ${disabled ? "disabled" : ""}`}
      onClick={handleCardClick}
      style={{ cursor: canView ? "pointer" : "default" }}
    >
      {/* Left Avatar: Creator */}
      <div className="battle-card-avatar-wrap left-avatar">
        <div className="battle-card-avatar">
          <img src="/logo.png" alt="Avatar" className="battle-card-avatar-img" />
        </div>
        <div className="battle-card-name">{shortName(creatorName)}</div>
      </div>

      {/* Center Details */}
      <div className="battle-card-center">
        <img src="/vs.png" alt="VS" className="battle-card-vs-img" />
        <div className="battle-card-entry">₹ {entryFee}</div>

        {/* Center action button when opponent has joined (Visible ONLY to match participants) */}
        {!isMock && !isOpenState && (
          <div style={{ marginTop: "4px" }}>
            {status === "joined" && isOwn ? (
              <button
                className="btn btn-sm"
                style={{ background: "var(--ludo-green)", color: "white", padding: "3px 12px", fontSize: "12px", fontWeight: "bold", border: "1px solid var(--border)", boxShadow: "0 2px 8px rgba(34, 197, 94, 0.3)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onAccept ? onAccept(e) : onView && onView(e);
                }}
              >
                ✅ Accept
              </button>
            ) : isParticipant ? (
              <button
                className="btn btn-sm"
                style={{ background: "var(--primary-blue)", color: "white", padding: "3px 12px", fontSize: "12px", border: "1px solid var(--primary-blue-dark)", boxShadow: "0 2px 8px rgba(10, 81, 225, 0.3)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onView && onView(e);
                }}
              >
                👁️ View
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* Right Side: Action Buttons when Open, or Opponent Avatar when Joined */}
      <div className="battle-card-avatar-wrap right-avatar" style={{ justifyContent: "center" }}>
        {isOpenState ? (
          !isMock && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
              {isOwn ? (
                <button
                  className="btn btn-sm"
                  style={{
                    background: "var(--ludo-red)",
                    color: "white",
                    border: "1px solid #dc2626",
                    padding: "6px 14px",
                    fontSize: "13px",
                    fontWeight: "bold",
                    borderRadius: "8px",
                    boxShadow: "0 2px 8px rgba(239, 68, 68, 0.4)",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel && onCancel(e);
                  }}
                >
                  ❌ Cancel
                </button>
              ) : (
                <button
                  className="btn btn-sm"
                  style={{
                    background: "var(--primary-gradient)",
                    color: "white",
                    border: "1px solid var(--primary-blue-dark)",
                    padding: "6px 16px",
                    fontSize: "13px",
                    fontWeight: "bold",
                    borderRadius: "8px",
                    boxShadow: "0 2px 8px rgba(10, 81, 225, 0.4)",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onJoin && onJoin(e);
                  }}
                >
                  🎮 Play
                </button>
              )}
            </div>
          )
        ) : (
          <>
            <div className="battle-card-avatar">
              <img src="/logo.png" alt="Avatar" className="battle-card-avatar-img" />
            </div>
            <div className="battle-card-name">{shortName(opponentName) || "Player 2"}</div>
          </>
        )}
      </div>
    </div>
  );
}

