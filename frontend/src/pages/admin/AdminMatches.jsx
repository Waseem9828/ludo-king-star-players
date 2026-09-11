import { useState, useEffect } from "react";
import useSWR from "swr";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { resolveMatchAdmin, clearMatchProofImages, deleteMatchAdmin, getMatchProofImages } from "../../lib/adminApi.js";
import Loading from "../../components/Loading.jsx";
import EmptyState from "../../components/EmptyState.jsx";

const statusBadge = {
  OPEN: "badge-open",
  FULL: "badge-pending",
  RUNNING: "badge-pending",
  ROOM_SHARED: "badge-pending",
  PLAYING: "badge-pending",
  RESULT_SUBMITTED: "badge-pending",
  DISPUTED: "badge-full",
  COMPLETED: "badge-neutral",
  SETTLED: "badge-neutral",
  CANCELLED: "badge-full",
  REFUNDED: "badge-full",
};

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getMatchTimerInfo(match, nowTs) {
  const isFinished = ["COMPLETED", "SETTLED", "CANCELLED", "REFUNDED"].includes(match.status);
  const hasCode = Boolean(match.roomCode);
  const isActive = ["JOINED", "ACCEPTED", "ROOM_SHARED", "PLAYING", "RESULT_SUBMITTED", "DISPUTED"].includes(match.status);

  if (isFinished || (!hasCode && !isActive)) {
    return { isRunning: false, remainingSec: null, isExpired: false, elapsedSec: 0 };
  }

  const startTime = new Date(match.roomCodeSharedAt || match.updatedAt || match.createdAt).getTime();
  const elapsedSec = Math.max(0, Math.floor((nowTs - startTime) / 1000));
  const totalLimitSec = 15 * 60; // 15 minutes = 900 seconds
  const remainingSec = totalLimitSec - elapsedSec;
  const isExpired = remainingSec <= 0;

  return {
    isRunning: true,
    remainingSec,
    isExpired,
    elapsedSec,
  };
}

function formatTimerString(seconds) {
  const absSec = Math.abs(seconds);
  const mins = Math.floor(absSec / 60);
  const secs = absSec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(mins)}:${pad(secs)}`;
}

export default function AdminMatches() {
  const { token } = useAuth();
  const { data, error, mutate } = useSWR("/admin/matches", { refreshInterval: 3000 });
  const loading = !data && !error;
  const matches = data || [];

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [actionError, setActionError] = useState("");
  const [actingId, setActingId] = useState(null);
  const [nowTs, setNowTs] = useState(Date.now());

  // Lightbox / Screenshot zoom state
  const [lightboxImage, setLightboxImage] = useState(null);
  
  // Lazy loaded proof images
  const [loadedProofs, setLoadedProofs] = useState({});

  const handleLoadProofs = async (matchId) => {
    try {
      const proofs = await getMatchProofImages(token, matchId);
      setLoadedProofs(prev => ({ ...prev, [matchId]: proofs }));
    } catch (err) {
      alert("Failed to load images: " + err.message);
    }
  };

  // Live ticker for countdown timer
  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const filteredMatches = matches.filter((m) => {
    let statusMatch = true;
    if (filterStatus === "EXPIRED") {
      const timerInfo = getMatchTimerInfo(m, nowTs);
      statusMatch = timerInfo.isRunning && timerInfo.isExpired;
    } else if (filterStatus === "DISPUTED") {
      statusMatch = m.status === "DISPUTED";
    } else if (filterStatus === "ACTIVE") {
      statusMatch = ["OPEN", "FULL", "RUNNING", "ROOM_SHARED", "PLAYING", "RESULT_SUBMITTED"].includes(m.status);
    } else if (filterStatus === "COMPLETED") {
      statusMatch = ["COMPLETED", "SETTLED"].includes(m.status);
    } else if (filterStatus === "CANCELLED") {
      statusMatch = ["CANCELLED", "REFUNDED"].includes(m.status);
    }

    const text = `${m.roomCode || ""} ${m._id || ""} ${m.creator?.name || ""} ${m.creator?.phone || ""} ${m.opponent?.name || ""} ${m.opponent?.phone || ""}`.toLowerCase();
    const textMatch = text.includes(searchTerm.toLowerCase().trim());

    return statusMatch && textMatch;
  });

  // SORTING: Priority 1 -> Expired 15-min timers & Disputed matches FIRST
  const sortedMatches = [...filteredMatches].sort((a, b) => {
    const timerA = getMatchTimerInfo(a, nowTs);
    const timerB = getMatchTimerInfo(b, nowTs);

    const isDoneA = ["COMPLETED", "SETTLED", "CANCELLED", "REFUNDED"].includes(a.status);
    const isDoneB = ["COMPLETED", "SETTLED", "CANCELLED", "REFUNDED"].includes(b.status);

    const isCriticalA = !isDoneA && (a.status === "DISPUTED" || (timerA.isRunning && timerA.isExpired));
    const isCriticalB = !isDoneB && (b.status === "DISPUTED" || (timerB.isRunning && timerB.isExpired));

    if (isCriticalA && !isCriticalB) return -1;
    if (!isCriticalA && isCriticalB) return 1;

    if (timerA.isRunning && !timerB.isRunning && !isDoneB) return -1;
    if (!timerA.isRunning && timerB.isRunning && !isDoneA) return 1;

    if (timerA.isRunning && timerB.isRunning) {
      return timerA.remainingSec - timerB.remainingSec;
    }

    if (isDoneA && !isDoneB) return 1;
    if (!isDoneA && isDoneB) return -1;

    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const handleResolve = async (match, action) => {
    setActingId(match._id);
    setActionError("");
    try {
      const updated = await resolveMatchAdmin(token, match._id, action);
      mutate(
        matches.map((m) => (m._id === updated._id ? updated : m)),
        { revalidate: false }
      );
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActingId(null);
    }
  };

  const handleClearImages = async (matchId) => {
    if (!window.confirm("Clear all screenshot proof images for this match to free database space?")) return;
    setActingId(matchId);
    setActionError("");
    try {
      await clearMatchProofImages(token, matchId);
      mutate(
        matches.map((m) => (m._id === matchId ? { ...m, resultProof: [] } : m)),
        { revalidate: false }
      );
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActingId(null);
    }
  };

  const handleDeleteMatch = async (matchId) => {
    if (!window.confirm("Are you sure you want to permanently delete this match record?")) return;
    setActingId(matchId);
    setActionError("");
    try {
      await deleteMatchAdmin(token, matchId);
      mutate(
        matches.filter((m) => m._id !== matchId),
        { revalidate: false }
      );
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActingId(null);
    }
  };

  const displayError = error ? error.message || String(error) : actionError;

  return (
    <div className="stack" style={{ gap: "16px" }}>
      <div className="admin-page-header">
        <h1>Matches ({matches.length})</h1>
        <span className="admin-page-header__subtitle">Monitor battles, proof screenshots, and settle disputes</span>
      </div>

      {displayError && <p className="notice-banner error">{displayError}</p>}

      {/* SEARCH + FILTER */}
      <div className="admin-filter-bar">
        <input
          type="text"
          className="input"
          placeholder="Search room, player, ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="admin-filter-chips">
          {[
            { key: "ALL", label: `All (${matches.length})` },
            { key: "EXPIRED", label: "⚠️ Overdue Timer" },
            { key: "DISPUTED", label: "🔴 Disputed" },
            { key: "ACTIVE", label: "Active" },
            { key: "COMPLETED", label: "Done" },
            { key: "CANCELLED", label: "Cancelled" },
          ].map((chip) => (
            <button
              key={chip.key}
              className={`admin-filter-chip ${filterStatus === chip.key ? "is-active" : ""}`}
              onClick={() => setFilterStatus(chip.key)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Loading label="Loading match rooms..." />
      ) : sortedMatches.length === 0 ? (
        <div className="card">
          <EmptyState icon="🎯" title="No Matches Found" description="No game matches match your search criteria." />
        </div>
      ) : (
        <div className="stack" style={{ gap: "16px" }}>
          {sortedMatches.map((match) => {
            const canDecide =
              ["JOINED", "ACCEPTED", "ROOM_SHARED", "PLAYING", "RESULT_SUBMITTED", "DISPUTED"].includes(match.status) &&
              match.creator &&
              match.opponent;
            const isFinished = ["COMPLETED", "CANCELLED", "REFUNDED", "SETTLED"].includes(match.status);
            const timerInfo = getMatchTimerInfo(match, nowTs);

            const cardStyle = timerInfo.isRunning && timerInfo.isExpired
              ? { padding: "16px", background: "var(--surface)", border: "2px solid #ef4444", boxShadow: "0 0 12px rgba(239, 68, 68, 0.25)" }
              : { padding: "16px", background: "var(--surface)" };

            return (
              <div key={match._id} className="card stack admin-match" style={cardStyle}>
                {timerInfo.isRunning && timerInfo.isExpired && (
                  <div style={{ background: "#fee2e2", border: "1px solid #ef4444", color: "#991b1b", padding: "8px 12px", borderRadius: "8px", fontWeight: "800", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>🚨 15-MINUTE GAME TIMER EXPIRED! (Overdue by {formatTimerString(timerInfo.remainingSec)})</span>
                    <span style={{ fontSize: "11px", background: "#ef4444", color: "white", padding: "2px 8px", borderRadius: "4px" }}>ACTION NEEDED</span>
                  </div>
                )}

                <div className="row-between" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span className={`badge ${statusBadge[match.status] || "badge-neutral"}`}>
                        {match.status}
                      </span>
                      <strong style={{ fontSize: "16px" }}>Room: {match.roomCode || "Not Set"}</strong>

                      {timerInfo.isRunning && !timerInfo.isExpired && (
                        <span className="admin-badge warning" style={{ fontSize: "12px", background: "#fef3c7", color: "#7c2d12", border: "1px solid #fcd34d", fontWeight: "800", padding: "2px 8px" }}>
                          ⏱️ Timer: {formatTimerString(timerInfo.remainingSec)}
                        </span>
                      )}
                    </div>

                    <p className="admin-row__amount" style={{ margin: "6px 0 2px" }}>
                      Entry {match.entryCoins} coins · Prize {match.prizeCoins} coins
                    </p>
                    <p className="text-muted" style={{ margin: 0, fontSize: "12px" }}>
                      ID: <span style={{ fontFamily: "monospace" }}>{match._id}</span> · {formatDate(match.createdAt)}
                    </p>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    {match.winner && (
                      <p style={{ fontWeight: "bold", color: "var(--success)", margin: 0 }}>
                        🏆 Winner: {match.winner.name || match.winner}
                      </p>
                    )}
                    {isFinished && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: "#ef4444", marginTop: "6px", fontSize: "12px" }}
                        disabled={actingId === match._id}
                        onClick={() => handleDeleteMatch(match._id)}
                      >
                        🗑 Delete Match
                      </button>
                    )}
                  </div>
                </div>

                {/* PLAYERS & FINANCIALS SUMMARY */}
                <div
                  style={{
                    background: "var(--surface-alt)",
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "16px",
                    fontSize: "13px",
                  }}
                >
                  <div style={{ flex: "1 1 45%" }}>
                    <p className="text-faint" style={{ margin: "0 0 2px" }}>Creator (Player 1)</p>
                    <p style={{ fontWeight: "bold", margin: 0 }}>
                      {match.creator?.name || "Unknown"} ({match.creator?.phone || "—"})
                    </p>
                  </div>
                  <div style={{ flex: "1 1 45%" }}>
                    <p className="text-faint" style={{ margin: "0 0 2px" }}>Opponent (Player 2)</p>
                    <p style={{ fontWeight: "bold", margin: 0 }}>
                      {match.opponent ? `${match.opponent.name} (${match.opponent.phone || "—"})` : "Waiting for player..."}
                    </p>
                  </div>
                  <div style={{ flex: "1 1 100%", borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                    <p className="text-muted" style={{ fontSize: "12px", margin: 0 }}>
                      Pool: <strong>{match.entryCoins * 2} Coins</strong> | Prize: <strong>{match.prizeCoins} Coins</strong> | Platform Fee: <strong>{(match.entryCoins * 2) - match.prizeCoins} Coins</strong>
                    </p>
                  </div>
                </div>

                {/* RESULT PROOF SCREENSHOTS */}
                {match.resultProof?.length > 0 && (
                  <div className="admin-match__proof" style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                    <div className="row-between" style={{ marginBottom: "8px" }}>
                      <p className="text-muted admin-match__proof-title" style={{ margin: 0 }}>
                        🖼 Player Result Proof Screenshots
                      </p>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: "#f59e0b", fontSize: "11px" }}
                        disabled={actingId === match._id}
                        onClick={() => handleClearImages(match._id)}
                      >
                        🧹 Clear Screenshots
                      </button>
                    </div>
                    
                    {!loadedProofs[match._id] ? (
                      <button 
                        className="btn btn-secondary btn-sm" 
                        style={{ width: "100%", padding: "8px", fontWeight: "bold" }}
                        onClick={() => handleLoadProofs(match._id)}
                      >
                        🖼️ Load Screenshot Images
                      </button>
                    ) : (
                      <div className="row admin-match__proof-list" style={{ gap: "12px" }}>
                        {loadedProofs[match._id].map((proof, i) => (
                          <div key={i} className="admin-match__proof-item" style={{ background: "var(--surface-alt)", padding: "8px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                            {proof.imageUrl ? (
                              <img
                                src={proof.imageUrl}
                                alt="Result proof"
                                className="admin-match__proof-image"
                                onClick={() => setLightboxImage(proof.imageUrl)}
                                style={{ cursor: "pointer", width: "100%", height: "110px", objectFit: "cover", borderRadius: "6px" }}
                              />
                            ) : (
                              <p className="text-faint" style={{ padding: "12px", fontStyle: "italic", fontSize: "11px" }}>
                                [Image cleared]
                              </p>
                            )}
                            <p style={{ margin: "4px 0 0", fontSize: "12px", fontWeight: "bold" }}>
                              {proof.user?.name || "Player"}: {proof.claimedResult}
                            </p>
                            <p className="text-faint" style={{ margin: "2px 0 0", fontSize: "10px" }}>
                              {formatDate(proof.submittedAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* LUDOROOM AUTO-VERIFICATION DATA */}
                {match.ludoRoomResult && (
                  <div className="admin-match__proof" style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                    <div className="row-between" style={{ marginBottom: "8px" }}>
                      <p className="text-muted admin-match__proof-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ color: "var(--primary)" }}>⚡</span> LudoRoom API Verification
                      </p>
                      <span className="badge badge-pending" style={{ fontSize: "10px" }}>Verified {formatDate(match.ludoRoomResult.webhookAt)}</span>
                    </div>
                    <div style={{ background: "rgba(10, 81, 225, 0.05)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(10, 81, 225, 0.1)" }}>
                      <p style={{ margin: "0 0 4px", fontSize: "13px" }}>
                        Ludo King Winner Name: <strong style={{ color: "var(--primary)", fontSize: "15px" }}>{match.ludoRoomResult.ludoWinnerName}</strong>
                      </p>
                      {match.status === "DISPUTED" && (
                        <p style={{ margin: 0, fontSize: "11px", color: "#b91c1c" }}>
                          ⚠️ The exact Ludo King name "<strong>{match.ludoRoomResult.ludoWinnerName}</strong>" did not precisely match "{match.creator.name}" or "{match.opponent.name}".
                          Check the winner name and declare the result below.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* DISPUTE RESOLUTION ACTIONS */}
                {canDecide && (
                  <div className="row admin-row__actions" style={{ flexWrap: "wrap", gap: "8px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                    {match.roomCode && (
                      <button
                        className="btn btn-sm"
                        style={{ background: "#6366f1", color: "#fff" }}
                        disabled={actingId === match._id}
                        onClick={async () => {
                          setActingId(match._id);
                          try {
                            const { checkLudoRoomResult } = await import("../../lib/adminApi.js");
                            const res = await checkLudoRoomResult(token, match._id);
                            toast.success(res.message);
                            mutateMatches();
                          } catch (err) {
                            toast.error(err.message || "Failed to check result");
                          } finally {
                            setActingId(null);
                          }
                        }}
                      >
                        🔄 Check LudoRoom API
                      </button>
                    )}
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={actingId === match._id}
                      onClick={() => handleResolve(match, "declare_creator_win")}
                    >
                      🏆 Declare {match.creator.name} Winner
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={actingId === match._id}
                      onClick={() => handleResolve(match, "declare_opponent_win")}
                    >
                      🏆 Declare {match.opponent.name} Winner
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={actingId === match._id}
                      onClick={() => {
                        if (window.confirm("Cancel this match and refund entry coins to both players?")) {
                          handleResolve(match, "cancel_and_refund");
                        }
                      }}
                    >
                      ✕ Cancel & Refund Both
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* FULLSCREEN LIGHTBOX MODAL */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <img
            src={lightboxImage}
            alt="Full view"
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: "12px", boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8)" }}
          />
        </div>
      )}
    </div>
  );
}
