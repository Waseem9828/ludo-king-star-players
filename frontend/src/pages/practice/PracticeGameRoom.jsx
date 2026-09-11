import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import useSWR from "swr";
import toast from "react-hot-toast";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { apiRequest } from "../../lib/apiClient.js";
import Loading from "../../components/Loading.jsx";
import Modal from "../../components/Modal.jsx";
import PracticeBoard from "./PracticeBoard.jsx";
import PracticeDice from "./PracticeDice.jsx";
import PracticeResultModal from "./PracticeResultModal.jsx";
import "./PracticeBoard.css";
import "./PracticeGameRoom.css";

export default function PracticeGameRoom() {
  const { gameId } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const { data: initialGame, mutate } = useSWR(`/practice/games/${gameId}`);
  const [game, setGame] = useState(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Connected");
  const [timeLeft, setTimeLeft] = useState(60);
  const [exitConfirmStep, setExitConfirmStep] = useState(0); // 0 = closed, 1 = first check, 2 = final loss warning

  useEffect(() => {
    if (initialGame) {
      setGame(initialGame);
    }
  }, [initialGame]);

  const handleSkipTurn = async () => {
    if (actionSubmitting) return;
    setActionSubmitting(true);
    try {
      const updated = await apiRequest(`/practice/games/${gameId}/skip-turn`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setGame(updated);
      mutate(updated, false);
    } catch (err) {
      console.error("Failed to skip turn:", err);
    } finally {
      setActionSubmitting(false);
    }
  };

  // Turn Countdown Timer (synchronized with server)
  useEffect(() => {
    if (!game || game.status !== "active") return;
    
    const calcTimeLeft = () => {
      if (!game.turnExpiresAt) return 60;
      const msLeft = new Date(game.turnExpiresAt).getTime() - Date.now();
      return Math.max(0, Math.floor(msLeft / 1000));
    };

    setTimeLeft(calcTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          const isMyTurn = String(game.currentTurnPlayerId) === String(user?._id) || String(game.currentTurnPlayerId) === String(game.players[0]?.userId);
          if (isMyTurn && !actionSubmitting) {
             handleSkipTurn();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [game?.currentTurnPlayerId, game?.stateVersion, game?.status, game?.turnExpiresAt]);

  // Realtime SSE Event Stream Listener for instant state updates
  useEffect(() => {
    if (!gameId) return;

    const eventSource = new EventSource(`/api/practice/stream/${gameId}`);

    eventSource.onopen = () => {
      setConnectionStatus("Connected");
    };

    eventSource.onmessage = () => {
      setConnectionStatus("Connected");
    };

    eventSource.addEventListener("state_update", (e) => {
      setConnectionStatus("Connected");
      try {
        const updatedState = JSON.parse(e.data);
        setGame(updatedState);
        mutate(updatedState, false);
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    });

    eventSource.onerror = () => {
      setConnectionStatus("Network Slow");
    };

    const handleOnline = () => setConnectionStatus("Connected");
    const handleOffline = () => setConnectionStatus("Network Slow");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      eventSource.close();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [gameId, mutate]);

  if (!game) return <Loading label="Loading Practice Game Room..." />;

  const myPlayer = game.players.find((p) => String(p.userId) === String(user?._id)) || game.players[0];
  const opponent = game.players.find((p) => String(p.userId) !== String(user?._id)) || game.players[1];

  const myColor = myPlayer?.color || "blue";
  const isMyTurn = String(game.currentTurnPlayerId) === String(user?._id) || String(game.currentTurnPlayerId) === String(myPlayer?.userId);

  const handleRollDice = async () => {
    if (!isMyTurn || game.diceRolled || actionSubmitting) return;

    setActionSubmitting(true);
    try {
      const updated = await apiRequest(`/practice/games/${gameId}/roll-dice`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setGame(updated);
      mutate(updated, false);
    } catch (err) {
      toast.error(err.message || "Failed to roll dice.");
    } finally {
      setActionSubmitting(false);
    }
  };
  const handleLeaveMatch = async () => {
    setActionSubmitting(true);
    try {
      await apiRequest(`/practice/games/${gameId}/leave`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      navigate("/practice");
    } catch (err) {
      toast.error(err.message || "Failed to leave match");
      setActionSubmitting(false);
    }
  };

  const handleSelectToken = async (tokenId) => {
    if (!isMyTurn || !game.diceRolled || actionSubmitting) return;

    setActionSubmitting(true);
    try {
      const updated = await apiRequest(`/practice/games/${gameId}/move-token`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: JSON.stringify({ tokenId }),
      });
      setGame(updated);
      mutate(updated, false);
    } catch (err) {
      toast.error(err.message || "Failed to move token.");
    } finally {
      setActionSubmitting(false);
    }
  };

  const isWinCompleted = game.status === "completed";
  const winnerPlayer = game.players.find((p) => String(p.userId) === String(game.winner));
  const isWinnerMe = String(game.winner) === String(user?._id) || String(game.winner) === String(myPlayer?.userId);

  // Dynamic player names for active home bases
  const playerNames = {};
  if (game.players && Array.isArray(game.players)) {
    game.players.forEach((p) => {
      if (String(p.userId) === String(user?._id) || String(p.userId) === String(myPlayer?.userId)) {
        playerNames[p.color] = "You";
      } else {
        playerNames[p.color] = p.name?.includes("AI") ? "Computer" : p.name || "Opponent";
      }
    });
  } else {
    playerNames.blue = "You";
    playerNames.green = opponent?.name?.includes("AI") ? "Computer" : opponent?.name || "Computer";
  }

  const currentTurnPlayer = game.players.find((p) => String(p.userId) === String(game.currentTurnPlayerId));
  const currentTurnColor = currentTurnPlayer?.color || (isMyTurn ? myColor : opponent?.color);

  return (
    <div className="king-ludo-game-screen">
      {/* Top Controls */}
      <div className="king-ludo-top-bar row-between">
        <button
          type="button"
          className="btn btn-secondary btn-sm exit-btn"
          onClick={() => setExitConfirmStep(1)}
        >
          ← Exit
        </button>
        <div className="connection-status-badge">
          <span className={`status-dot ${connectionStatus === "Connected" ? "dot-online" : "dot-slow"}`} />
          <span>{connectionStatus === "Connected" ? "Online" : "Network Slow"}</span>
        </div>
      </div>

      {/* Screenshot Match: Top Angled Banner with Gold Borders */}
      <div className="king-ludo-banner-wrap">
        <div className="king-ludo-banner">
          <h1 className="king-ludo-title">King of Ludo</h1>
        </div>
      </div>

      {/* 15x15 Board matching screenshot */}
      <div className="king-board-flex-wrapper">
        <PracticeBoard
          tokenPositions={game.tokenPositions}
          movableTokenIds={game.movableTokenIds || []}
          myColor={myColor}
          isMyTurn={isMyTurn}
          currentTurnColor={currentTurnColor}
          onSelectToken={handleSelectToken}
          playerNames={playerNames}
        />
      </div>

      {/* Screenshot Match: 3D Yellow Down Arrow Icon */}
      <div className="king-down-arrow-container">
        <div className="king-3d-down-arrow" />
      </div>

      {/* Screenshot Match: Bottom Metallic Control Bar */}
      <div className="king-bottom-control-bar">
        {/* Left Player Box */}
        <div className={`bottom-player-box player-left ${isMyTurn ? "active-player-glow" : ""}`}>
          <svg width="24" height="30" viewBox="0 0 24 32" fill="none">
            <path
              d="M12 2C7.58 2 4 5.58 4 10C4 16 12 28 12 28C12 28 20 16 20 10C20 5.58 16.42 2 12 2Z"
              fill={myColor === "red" ? "#dc2626" : myColor === "yellow" ? "#facc15" : myColor === "green" ? "#16a34a" : "#2563eb"}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <circle cx="12" cy="10" r="4" fill="#ffffff" opacity="0.95" />
          </svg>
          <div className="player-meta-info">
            <span className="player-label-yellow">You</span>
            <div className="lives-row">
              <span className="lives-text">{"❤️".repeat(myPlayer.lives || 0)}</span>
              {isMyTurn && <span className="timer-chip">⏱️ {timeLeft}s</span>}
            </div>
          </div>
        </div>

        {/* Center Pink/Rose Dice Box */}
        <div className="bottom-dice-center-box">
          <PracticeDice
            diceValue={game.diceValue || 0}
            disabled={!isMyTurn || game.diceRolled || actionSubmitting}
            isMyTurn={isMyTurn}
            turnColor={currentTurnColor}
            onRoll={handleRollDice}
          />
        </div>

        {/* Right Player Box */}
        <div className={`bottom-player-box player-right ${!isMyTurn ? "active-player-glow" : ""}`}>
          <div className="player-meta-info text-right">
            <span className="player-label-yellow">{opponent?.name?.includes("AI") ? "Bot 🤖" : opponent?.name || "Opponent"}</span>
            <div className="lives-row">
              {!isMyTurn && <span className="timer-chip">⏱️ {timeLeft}s</span>}
              <span className="lives-text">{"❤️".repeat(opponent?.lives || 0)}</span>
            </div>
          </div>
          <svg width="24" height="30" viewBox="0 0 24 32" fill="none">
            <path
              d="M12 2C7.58 2 4 5.58 4 10C4 16 12 28 12 28C12 28 20 16 20 10C20 5.58 16.42 2 12 2Z"
              fill={opponent?.color === "yellow" ? "#facc15" : opponent?.color === "red" ? "#dc2626" : opponent?.color === "green" ? "#16a34a" : "#2563eb"}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <circle cx="12" cy="10" r="4" fill="#ffffff" opacity="0.95" />
          </svg>
        </div>
      </div>

      {game.lastMoveText && <p className="king-last-move">{game.lastMoveText}</p>}

      {/* Result Completion Modal */}
      <PracticeResultModal
        isOpen={isWinCompleted}
        winnerName={winnerPlayer?.name}
        isWinnerMe={isWinnerMe}
        onPlayAgain={() => navigate("/practice")}
      />

      {/* Exit Modal Step 1: First Confirmation */}
      <Modal isOpen={exitConfirmStep === 1} onClose={() => setExitConfirmStep(0)} title="⚠️ Exit Practice Match?">
        <div className="stack">
          <p style={{ fontSize: "14px", lineHeight: "1.5", color: "#334155" }}>
            Are you sure you want to exit the match? If you exit now, you will <strong>LOSE</strong> this game!
          </p>
          <div className="row-between" style={{ gap: "10px", marginTop: "10px" }}>
            <button className="btn btn-secondary flex-1" onClick={() => setExitConfirmStep(0)}>
              Cancel & Play
            </button>
            <button className="btn btn-danger flex-1" onClick={() => setExitConfirmStep(2)}>
              Yes, Next →
            </button>
          </div>
        </div>
      </Modal>

      {/* Exit Modal Step 2: Final Double Confirmation */}
      <Modal isOpen={exitConfirmStep === 2} onClose={() => setExitConfirmStep(0)} title="🚨 Final Confirmation: You Will Lose!">
        <div className="stack">
          <p style={{ fontSize: "14px", fontWeight: "700", color: "#dc2626", lineHeight: "1.5" }}>
            Warning: Quitting now will forfeit the game immediately and give victory to your opponent!
          </p>
          <p style={{ fontSize: "13px", color: "#475569" }}>
            Are you 100% sure you want to leave and accept a loss?
          </p>
          <div className="row-between" style={{ gap: "10px", marginTop: "12px" }}>
            <button className="btn btn-secondary flex-1" onClick={() => setExitConfirmStep(0)}>
              ← Go Back & Play
            </button>
            <button className="btn btn-danger flex-1" onClick={handleLeaveMatch}>
              CONFIRM EXIT (LOSE MATCH)
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
