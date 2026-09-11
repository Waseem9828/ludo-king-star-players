import { useCallback, useEffect, useState, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useSound } from "../contexts/SoundContext.jsx";
import { getMatch, submitResultProof, acceptOpponent, shareRoomCode, cancelBattle } from "../lib/matchApi.js";
import { MATCH_STATUS_META } from "../lib/matchStatus.js";
import { friendlyError } from "../lib/errors.js";
import { UserIcon, PencilIcon, BackIcon } from "../components/Icons.jsx";
import { getSocket, subscribeMatchRoom, leaveMatchRoom } from "../lib/socketClient.js";
import Loading from "../components/Loading.jsx";
import Modal from "../components/Modal.jsx";
import toast from "react-hot-toast";
import useSWR, { mutate } from "swr";
import "./MatchRoomDetail.css";

const MAX_FILE_BYTES = 2.5 * 1024 * 1024;

const CANCEL_REASONS_BEFORE_CODE = [
  "Opponent taking too long / not responding",
  "Entered wrong entry amount",
  "Changed my mind / Don't want to play",
  "Other reason",
];

const CANCEL_REASONS_AFTER_CODE = [
  "Opponent didn't join room in Ludo King",
  "Invalid or expired room code",
  "Ludo King app crashed / game error",
  "Other reason",
];

function compressImage(file, maxSizeKB = 300) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Max dimension constraints
        const MAX_DIMENSION = 1200;
        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width *= MAX_DIMENSION / height;
            height = MAX_DIMENSION;
          }
        }
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Binary search for optimal quality to hit size target (roughly)
        let dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Failed to process image"));
    };
    reader.onerror = () => reject(new Error("Failed to read image"));
  });
}

export default function MatchRoomDetail() {
  const { id } = useParams();
  const { token, user, isAuthenticated } = useAuth();
  const { playMatchFound, playWin, playLose } = useSound();
  const navigate = useNavigate();

  const prevStatus = useRef(null);

  const [claimedResult, setClaimedResult] = useState("WIN");
  const [proofPreview, setProofPreview] = useState("");
  const [proofDataUrl, setProofDataUrl] = useState("");
  const [proofError, setProofError] = useState("");
  const [proofSuccess, setProofSuccess] = useState("");
  const [proofSubmitting, setProofSubmitting] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedImage, setExpandedImage] = useState(null);

  // Cancellation Modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedCancelReason, setSelectedCancelReason] = useState("");
  const [cancelCustomNote, setCancelCustomNote] = useState("");

  // Live timer tick state
  const [nowTs, setNowTs] = useState(Date.now());
  const [isEditingCode, setIsEditingCode] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time Socket.io match room synchronization
  useEffect(() => {
    if (!id) return;
    const socket = getSocket();
    subscribeMatchRoom(id);

    const handleMatchEvent = () => {
      mutate(`/matches/${id}`);
    };

    socket.on("match:updated", handleMatchEvent);
    socket.on("match:joined", handleMatchEvent);
    socket.on("match:cancelled", handleMatchEvent);

    return () => {
      leaveMatchRoom(id);
      socket.off("match:updated", handleMatchEvent);
      socket.off("match:joined", handleMatchEvent);
      socket.off("match:cancelled", handleMatchEvent);
    };
  }, [id]);

  const { data: match, error: matchError } = useSWR(`/matches/${id}`, {
    refreshInterval: (matchData) => {
      if (matchData && ["COMPLETED", "SETTLED", "CANCELLED", "REFUNDED", "DISPUTED"].includes(matchData.status)) {
        return 0;
      }
      return 2000;
    }
  });

  const loading = !match && !matchError;
  const error = matchError ? friendlyError(matchError) : "";

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (match) {
      if (prevStatus.current) {
        if (prevStatus.current === "WAITING" && match.status === "JOINED") {
          playMatchFound();
        } else if (
          prevStatus.current !== "SETTLED" &&
          prevStatus.current !== "COMPLETED" &&
          (match.status === "SETTLED" || match.status === "COMPLETED")
        ) {
          const winnerId = match.winner?._id ? String(match.winner._id) : String(match.winner || "");
          const loserId = match.loser?._id ? String(match.loser._id) : String(match.loser || "");
          const uId = String(user?.id || user?._id || "");
          if (winnerId && winnerId === uId) playWin();
          else if (loserId && loserId === uId) playLose();
        }
      }
      prevStatus.current = match.status;
    }
  }, [match, playMatchFound, playWin, playLose, user?.id]);

  if (loading) return <Loading label="Loading match room..." />;
  if (error)
    return (
      <div className="stack">
        <Link to="/match-room" className="match-detail__back">
          ← Back to Match Room
        </Link>
        <p className="notice-banner">{error}</p>
      </div>
    );
  if (!match) return null;

  const getIdStr = (obj) => {
    if (!obj) return "";
    if (typeof obj === "string") return obj;
    return obj._id ? String(obj._id) : String(obj);
  };

  const currentUserId = String(user?.id || user?._id || "");
  const creatorId = getIdStr(match.creator);
  const opponentId = getIdStr(match.opponent);
  const winnerId = getIdStr(match.winner);
  const loserId = getIdStr(match.loser);

  const meta = MATCH_STATUS_META[match.status] || { label: match.status, badge: "badge-neutral" };
  const isWinner = winnerId && winnerId === currentUserId;
  const isLoser = loserId && loserId === currentUserId;
  const isCreator = creatorId && creatorId === currentUserId;
  const isOpponent = opponentId && opponentId === currentUserId;
  const isParticipant = isCreator || isOpponent;

  const mySubmittedResult = isCreator ? match.creatorResult : match.opponentResult;
  const canSubmitProof =
    isParticipant && !mySubmittedResult && ["ROOM_SHARED", "PLAYING", "RESULT_SUBMITTED"].includes(match.status);

  const hasRoomCode = !!match.roomCode;
  const cancelReasonsList = hasRoomCode ? CANCEL_REASONS_AFTER_CODE : CANCEL_REASONS_BEFORE_CODE;

  // 15-Minute Countdown Timer Calculation
  const isFinished = ["COMPLETED", "SETTLED", "CANCELLED", "REFUNDED"].includes(match.status);
  const isTimerActive = !isFinished && (hasRoomCode || ["ROOM_SHARED", "PLAYING", "RESULT_SUBMITTED", "DISPUTED"].includes(match.status));

  let timerRemainingSec = null;
  let isTimerExpired = false;

  if (isTimerActive) {
    const startTime = new Date(match.roomCodeSharedAt || match.updatedAt || match.createdAt).getTime();
    const elapsedSec = Math.max(0, Math.floor((nowTs - startTime) / 1000));
    const totalLimitSec = 15 * 60; // 15 mins = 900 seconds
    timerRemainingSec = totalLimitSec - elapsedSec;
    isTimerExpired = timerRemainingSec <= 0;
  }

  const formatTimerClock = (seconds) => {
    const absSec = Math.abs(seconds);
    const mins = Math.floor(absSec / 60);
    const secs = absSec % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(mins)}:${pad(secs)}`;
  };

  const handleAction = async (actionFn, successMsg = "") => {
    setActionLoading(true);
    setProofError("");
    setProofSuccess("");
    try {
      await actionFn();
      if (successMsg) toast.success(successMsg);
      mutate(`/matches/${id}`);
    } catch (err) {
      toast.error(friendlyError(err));
      setProofError(friendlyError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyRoomCode = () => {
    if (!match.roomCode) return;
    const shareText = `Play Ludo King with me!
Room Code: ${match.roomCode}
Start Game > Play with Friends > Join > Enter Room code.
OR,
Click below to join:
https://lk.gggred.com/?rmc=${match.roomCode}&gt=0&po=0
-------
Install ludo King adda .com:
Android: https://ludokingadda.com/download

Believe me this is an awesome game!
1 Billion players worldwide!`;
    navigator.clipboard.writeText(shareText);
    toast.success("Room Code copied!");
  };

  const handleOpenCancelModal = () => {
    setSelectedCancelReason(cancelReasonsList[0]);
    setCancelCustomNote("");
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    const finalReason =
      selectedCancelReason === "Other reason" && cancelCustomNote.trim()
        ? cancelCustomNote.trim()
        : selectedCancelReason;

    setShowCancelModal(false);
    await handleAction(() => cancelBattle(token, id, finalReason), "Battle cancelled.");
  };

  const handleProofFileChange = async (e) => {
    setProofError("");
    const file = e.target.files?.[0];
    if (!file) {
      setProofPreview("");
      setProofDataUrl("");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setProofError("Please choose a PNG, JPEG or WebP image.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setProofError("Image is too large. Please choose a file under 2.5MB.");
      e.target.value = "";
      return;
    }
    try {
      const dataUrl = await compressImage(file);
      setProofDataUrl(dataUrl);
      setProofPreview(dataUrl);
    } catch (err) {
      setProofError(err.message);
    }
  };

  const handleSubmitProof = async (e) => {
    e.preventDefault();
    if (claimedResult === "WIN" && !proofDataUrl) {
      toast.error("Screenshot required for 'I Won'!");
      setProofError("Winning screenshot proof is required when selecting 'I Won'!");
      return;
    }
    setProofSubmitting(true);
    try {
      await submitResultProof(token, id, { imageUrl: proofDataUrl || "", claimedResult });
      toast.success("Match result submitted!");
      setProofSuccess("Result submitted successfully.");
      setProofPreview("");
      setProofDataUrl("");
      mutate(`/matches/${id}`);
    } catch (err) {
      toast.error(friendlyError(err));
      setProofError(friendlyError(err));
    } finally {
      setProofSubmitting(false);
    }
  };

  return (
    <div className="match-detail__container">
      <div className="match-detail__top-nav">
        <Link to="/match-room" className="match-detail__back">
          <BackIcon size={18} /> Back to Match Room
        </Link>
        <span className={"badge " + meta.badge}>{meta.label}</span>
      </div>

      {/* VS Arena Glass Card */}
      <div className="match-arena-card">
        <div className="match-arena__header">
          <span style={{ fontSize: "14px", fontWeight: "800", color: "#f8fafc" }}>🎮 Ludo Battle</span>
          <span className="match-arena__id">ID: #{match._id.slice(-6).toUpperCase()}</span>
        </div>

        {/* Players VS Layout */}
        <div className="match-arena__versus">
          <div className="match-arena__player">
            <div className="match-arena__avatar-ring">
              <div className="match-arena__avatar-inner">
                <UserIcon size={32} />
              </div>
            </div>
            <span className="match-arena__player-name">{match.creator?.name || "Player 1"}</span>
            <span className="match-arena__player-role">Host</span>
          </div>

          <div className="match-arena__vs-badge">VS</div>

          <div className="match-arena__player">
            <div className={`match-arena__avatar-ring ${!match.opponent ? "empty" : ""}`}>
              <div className="match-arena__avatar-inner">
                <UserIcon size={32} />
              </div>
            </div>
            <span className="match-arena__player-name">{match.opponent?.name || "Waiting..."}</span>
            <span className="match-arena__player-role">Challenger</span>
          </div>
        </div>

        {/* Stats Chips */}
        <div className="match-arena__stats">
          <div className="match-stat-chip">
            <span className="match-stat-chip__label">Entry Fee</span>
            <span className="match-stat-chip__value">🪙 {match.entryCoins}</span>
          </div>
          <div className="match-stat-chip">
            <span className="match-stat-chip__label">Winner Prize</span>
            <span className="match-stat-chip__value" style={{ color: "#22c55e" }}>🏆 {match.prizeCoins}</span>
          </div>
        </div>

        {/* Room Code Display Banner */}
        {hasRoomCode && (
          <div className="room-code-banner">
            <span className="room-code-banner__title">🎲 Ludo King Room Code</span>
            
            {isEditingCode && isCreator ? (
              <div style={{ display: "flex", gap: "8px", margin: "8px 0" }}>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  autoFocus
                  className="input code-input"
                  placeholder="8-digit code (e.g. 01234567)"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && /^[0]\d{7}$/.test(roomCodeInput.trim())) {
                      await handleAction(() => shareRoomCode(token, id, roomCodeInput.trim()), "Room code updated!");
                      setIsEditingCode(false);
                    }
                  }}
                />
                <button
                  className="btn btn-primary"
                  disabled={actionLoading || !/^[0]\d{7}$/.test(roomCodeInput.trim())}
                  onClick={async () => {
                    await handleAction(() => shareRoomCode(token, id, roomCodeInput.trim()), "Room code updated!");
                    setIsEditingCode(false);
                  }}
                >
                  Save
                </button>
                <button className="btn btn-ghost" onClick={() => setIsEditingCode(false)}>Cancel</button>
              </div>
            ) : (
              <div className="room-code-banner__code" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
                {match.roomCode}
                {isCreator && (
                  <button 
                    className="btn btn-ghost" 
                    style={{ padding: "4px", minHeight: "auto", color: "var(--primary-blue)" }}
                    onClick={() => {
                      setRoomCodeInput(match.roomCode);
                      setIsEditingCode(true);
                    }}
                  >
                    <PencilIcon size={20} />
                  </button>
                )}
              </div>
            )}
            
            <div className="row" style={{ gap: "8px", justifyContent: "center", flexWrap: "wrap", width: "100%" }}>
              <button className="btn-copy-code" style={{ flex: 1, minWidth: "140px" }} onClick={handleCopyRoomCode}>
                📤 Share Code
              </button>
              <a 
                href={`https://lk.gggred.com/?rmc=${match.roomCode}&gt=0&po=0`}
                target="_blank" 
                rel="noopener noreferrer"
                className="btn-copy-code"
                style={{ flex: 1, minWidth: "140px", background: "var(--primary-gradient)", color: "white", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", border: "none" }}
              >
                🎮 Play Ludo King
              </a>
            </div>
          </div>
        )}

        {/* 15-Minute Game Countdown Timer Card */}
        {isTimerActive && (
          <div className={`match-timer-card ${isTimerExpired ? "is-expired" : ""}`}>
            <div className="match-timer__header">
              <span>{isTimerExpired ? "🚨 15-Min Time Expired" : "⏱️ Match Time Remaining"}</span>
            </div>
            <div className="match-timer__clock">
              {isTimerExpired ? `+${formatTimerClock(timerRemainingSec)}` : formatTimerClock(timerRemainingSec)}
            </div>
            <p className="match-timer__subtitle">
              {isTimerExpired
                ? "Game timer has ended. Please declare your match outcome (I Won / I Lost) below immediately!"
                : "Complete your match in Ludo King and declare outcome before timer expires."}
            </p>
          </div>
        )}

        {/* --- LIFECYCLE CONTROLS --- */}
        {isParticipant && match.status === "WAITING" && (
          <div className="notice-banner">Waiting for an opponent to join your battle...</div>
        )}

        {isCreator && match.status === "JOINED" && (
          <div className="stack" style={{ gap: "10px" }}>
            <div className="notice-banner">Opponent {match.opponent?.name} has joined! Tap Accept to proceed.</div>
            <button
              className="btn btn-primary"
              style={{ background: "var(--primary-gradient)", padding: "12px", fontSize: "15px", fontWeight: "bold" }}
              disabled={actionLoading}
              onClick={() => handleAction(() => acceptOpponent(token, id), "Opponent accepted!")}
            >
              ✅ Accept Opponent
            </button>
          </div>
        )}

        {isOpponent && match.status === "JOINED" && (
          <div className="notice-banner">Waiting for creator ({match.creator?.name}) to accept you...</div>
        )}

        {isCreator && match.status === "ACCEPTED" && (
          <div className="stack" style={{ gap: "12px" }}>
            <div className="notice-banner">Opponent accepted! Open Ludo King, create a room, and enter the code below.</div>
            <div className="field">
              <label style={{ color: "var(--primary-blue)", fontWeight: "bold" }}>Ludo King Room Code</label>
              <input
                type="tel"
                className="input"
                style={{ fontSize: "16px", padding: "12px", border: "2px solid var(--primary-blue)" }}
                placeholder="Enter 8-digit Room Code (starts with 0)"
                value={roomCodeInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  if (val.length <= 8) setRoomCodeInput(val);
                }}
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ background: "var(--primary-gradient)", padding: "12px", fontSize: "15px", fontWeight: "bold" }}
              disabled={actionLoading || !/^[0]\d{7}$/.test(roomCodeInput.trim())}
              onClick={() => handleAction(() => shareRoomCode(token, id, roomCodeInput.trim()), "Room code shared!")}
            >
              🚀 Share Room Code
            </button>
          </div>
        )}

        {isOpponent && match.status === "ACCEPTED" && (
          <div className="notice-banner">You were accepted! Waiting for creator to share the room code...</div>
        )}

        {isParticipant && ["ROOM_SHARED", "PLAYING", "RESULT_SUBMITTED"].includes(match.status) && (
          <div className="notice-banner">
            {mySubmittedResult
              ? "You have submitted your result. Waiting for opponent/admin resolution."
              : "Play the match in Ludo King using the Room Code above, then declare your result below."}
          </div>
        )}

        {["COMPLETED", "SETTLED"].includes(match.status) && (
          <div className="notice-banner" style={{ background: isWinner ? "rgba(34,197,94,0.2)" : undefined }}>
            {isWinner
              ? `🎉 You WON ${match.prizeCoins} coins!`
              : isLoser
              ? "❌ You lost this battle."
              : `Winner: ${match.winner?.name || "—"}`}
          </div>
        )}

        {match.status === "DISPUTED" && (
          <div className="notice-banner">⚠️ This match is under dispute. Admin will review screenshots and settle.</div>
        )}

        {/* CANCEL BUTTON */}
        {isParticipant && ["WAITING", "JOINED", "ACCEPTED", "ROOM_SHARED", "PLAYING"].includes(match.status) && (
          <button
            className="btn btn-outline"
            style={{ borderColor: "var(--ludo-red)", color: "var(--ludo-red)", marginTop: "8px", fontWeight: "bold" }}
            disabled={actionLoading}
            onClick={handleOpenCancelModal}
          >
            ❌ Cancel Battle
          </button>
        )}
      </div>

      {proofError && <p className="notice-banner">{proofError}</p>}
      {proofSuccess && <p className="notice-banner">{proofSuccess}</p>}

      {/* --- RESULT PROOF SUBMISSION --- */}
      {canSubmitProof && (
        <div className="result-form-card stack">
          <p className="stat-label" style={{ fontSize: "16px", color: "#f8fafc", fontWeight: "bold" }}>
            Declare Match Outcome
          </p>

          <div className="notice-banner error" style={{ padding: "10px", fontSize: "13px", lineHeight: "1.4" }}>
            <strong>⚠️ STRICT PENALTIES FOR FAKE SCREENSHOTS & ABUSIVE BEHAVIOR:</strong><br/>
            • 1st Offense: ₹1,000 Penalty.<br/>
            • 2nd Offense: ₹2,500 Penalty.<br/>
            • 3rd Offense: ₹5,000 Penalty & Permanent Ban.<br/>
            Abusing chat, uploading wrong results, or delaying matches intentionally will result in strict action. Play fair!
          </div>

          <form className="stack" onSubmit={handleSubmitProof} style={{ gap: "14px", marginTop: "4px" }}>
            <div className="outcome-toggle-group">
              <button
                type="button"
                className={`btn-outcome ${claimedResult === "WIN" ? "win-active" : ""}`}
                onClick={() => setClaimedResult("WIN")}
              >
                🏆 I WON
              </button>
              <button
                type="button"
                className={`btn-outcome ${claimedResult === "LOSS" ? "loss-active" : ""}`}
                onClick={() => setClaimedResult("LOSS")}
              >
                ❌ I LOST
              </button>
            </div>

            {claimedResult === "WIN" && (
              <div className="field">
                <label style={{ color: "#f8fafc", marginBottom: "8px", display: "block", fontSize: "14px", fontWeight: "bold" }}>
                  Winning Screenshot <span style={{ color: "#ef4444" }}>*Required</span>
                </label>
                
                <div 
                  style={{
                    border: "2px dashed rgba(255,255,255,0.3)",
                    borderRadius: "12px",
                    padding: proofPreview ? "8px" : "24px 16px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: "rgba(0,0,0,0.2)",
                    position: "relative",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => document.getElementById('proof-image').click()}
                >
                  <input
                    id="proof-image"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleProofFileChange}
                    disabled={proofSubmitting}
                    style={{ display: "none" }}
                  />
                  {!proofPreview ? (
                    <div style={{ color: "var(--text-muted)", fontSize: "14px", pointerEvents: "none" }}>
                      <div style={{ fontSize: "28px", marginBottom: "8px" }}>📸</div>
                      <strong>Tap here to select your winning screenshot</strong><br/>
                      <span style={{ fontSize: "12px", opacity: 0.8 }}>(PNG, JPG, WebP max 2.5MB)</span>
                    </div>
                  ) : (
                    <div style={{ position: "relative", width: "100%" }}>
                      <img
                        src={proofPreview}
                        alt="Screenshot preview"
                        style={{
                          width: "100%",
                          maxHeight: 380,
                          objectFit: "contain",
                          borderRadius: "10px",
                          border: "1px solid var(--border)",
                          display: "block",
                          background: "#090d16",
                          cursor: "pointer"
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedImage(proofPreview);
                        }}
                      />
                      <div 
                        style={{ 
                          position: "absolute", 
                          top: "8px", 
                          right: "8px", 
                          background: "rgba(0,0,0,0.75)", 
                          padding: "5px 12px", 
                          borderRadius: "16px", 
                          fontSize: "12px", 
                          color: "white", 
                          fontWeight: "bold",
                          backdropFilter: "blur(4px)"
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedImage(proofPreview);
                        }}
                      >
                        🔍 Expand Left-Right / Tap to Change
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {claimedResult === "LOSS" && (
              <p className="notice-banner" style={{ fontSize: "13px", background: "rgba(239, 68, 68, 0.1)", color: "#fca5a5" }}>
                Selecting "I LOST" will immediately settle the match in favor of your opponent. Are you sure?
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-block"
              style={{ padding: "14px", fontSize: "16px", fontWeight: "bold", background: "var(--primary-gradient)", marginTop: "4px", border: "none" }}
              disabled={proofSubmitting || (claimedResult === "WIN" && !proofDataUrl)}
            >
              {proofSubmitting ? "Submitting..." : "Submit Result"}
            </button>
          </form>
        </div>
      )}

      {/* --- RESULT PROOF VIEWER --- */}
      {match.resultProof?.length > 0 && (
        <div className="card stack" style={{ padding: "16px", borderRadius: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <p className="stat-label" style={{ fontSize: "15px", color: "var(--text)", fontWeight: "bold", margin: 0 }}>
              📸 Submitted Proof Screenshots
            </p>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Tap image to expand</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
            {match.resultProof.map((proof, i) => (
              <div 
                key={i} 
                style={{ 
                  background: "var(--surface-alt)", 
                  borderRadius: "14px", 
                  padding: "12px",
                  border: "1px solid var(--border)",
                  width: "100%"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span style={{ fontSize: "14px", fontWeight: "bold", color: "var(--text)" }}>
                    👤 {proof.user?.name || "Player"}
                  </span>
                  <span 
                    style={{ 
                      padding: "4px 12px", 
                      borderRadius: "12px", 
                      fontSize: "12px", 
                      fontWeight: "bold",
                      background: proof.claimedResult === "WIN" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                      color: proof.claimedResult === "WIN" ? "var(--ludo-green)" : "#ef4444",
                      border: proof.claimedResult === "WIN" ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(239,68,68,0.3)"
                    }}
                  >
                    Claimed: {proof.claimedResult}
                  </span>
                </div>

                {proof.imageUrl ? (
                  <div 
                    style={{ position: "relative", width: "100%", cursor: "pointer", borderRadius: "10px", overflow: "hidden" }}
                    onClick={() => setExpandedImage(proof.imageUrl)}
                  >
                    <img
                      src={proof.imageUrl}
                      alt="Result proof"
                      style={{
                        width: "100%",
                        maxHeight: 380,
                        objectFit: "contain",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        display: "block",
                        background: "#090d16"
                      }}
                    />
                    <div 
                      style={{ 
                        position: "absolute", 
                        bottom: "8px", 
                        right: "8px", 
                        background: "rgba(0,0,0,0.8)", 
                        padding: "5px 12px", 
                        borderRadius: "16px", 
                        fontSize: "12px", 
                        color: "white", 
                        fontWeight: "bold",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        backdropFilter: "blur(4px)"
                      }}
                    >
                      🔍 Expand Image Left-Right
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: 120,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: "10px",
                      border: "1px dashed var(--border)",
                      fontSize: "13px",
                      color: "var(--text-muted)",
                    }}
                  >
                    No Screenshot Uploaded
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- CANCELLATION OPTIONS MODAL --- */}
      {showCancelModal && (
        <Modal title="Cancel Battle" onClose={() => setShowCancelModal(false)}>
          <div className="stack" style={{ gap: "14px" }}>
            <p className="text-muted" style={{ fontSize: "14px" }}>
              Please select a reason for cancelling this battle:
            </p>

            <div className="stack" style={{ gap: "8px" }}>
              {cancelReasonsList.map((reason, idx) => (
                <label
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background: "var(--bg-lighter)",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    border: selectedCancelReason === reason ? "1px solid var(--primary)" : "1px solid transparent",
                  }}
                >
                  <input
                    type="radio"
                    name="cancelReason"
                    checked={selectedCancelReason === reason}
                    onChange={() => setSelectedCancelReason(reason)}
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            {selectedCancelReason === "Other reason" && (
              <div className="field">
                <label>Specify reason</label>
                <input
                  className="input"
                  placeholder="Type your reason..."
                  value={cancelCustomNote}
                  onChange={(e) => setCancelCustomNote(e.target.value)}
                />
              </div>
            )}

            <div className="row-between" style={{ marginTop: "10px" }}>
              <button className="btn btn-ghost" onClick={() => setShowCancelModal(false)}>
                Go Back
              </button>
              <button
                className="btn"
                style={{ background: "var(--ludo-red)", color: "white" }}
                disabled={actionLoading}
                onClick={handleConfirmCancel}
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* --- EXPANDED IMAGE LIGHTBOX MODAL --- */}
      {expandedImage && (
        <div 
          className="image-lightbox-overlay"
          onClick={() => setExpandedImage(null)}
        >
          <div className="image-lightbox-container" onClick={(e) => e.stopPropagation()}>
            <button 
              className="image-lightbox-close"
              onClick={() => setExpandedImage(null)}
              title="Close image"
            >
              ✕
            </button>
            <img 
              src={expandedImage} 
              alt="Expanded Match Proof" 
              className="image-lightbox-img"
            />
            <div className="image-lightbox-footer">
              <span>🔍 Fullscreen Room Image View</span>
              <button className="btn btn-sm btn-ghost" onClick={() => setExpandedImage(null)} style={{ color: "#ffffff" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

