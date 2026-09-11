import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import useSWR from "swr";
import toast from "react-hot-toast";
import { useAuth } from "../../contexts/AuthContext.jsx";
import Loading from "../../components/Loading.jsx";
import "./PracticeLobby.css";

export default function PracticeWaitingRoom() {
  const { id } = useParams();
  const { token, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const { data: room, mutate } = useSWR(isAuthenticated ? `/practice/rooms/${id}` : null, {
    refreshInterval: 2000, // Polls every 2s until guest joins
  });

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (room && room.status === "active" && room.gameId) {
      toast.success("Opponent joined! Entering game...");
      navigate(`/practice/game/${room.gameId}`);
    }
  }, [room, navigate]);

  if (!room) return <Loading label="Connecting to practice room..." />;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    toast.success("Room code copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const text = `🎮 Join my Practice Ludo Match on ludo King adda .com! Room Code: ${room.code}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="practice-lobby-container text-center">
      <div className="practice-lobby-header row-between">
        <Link to="/practice" className="btn btn-secondary btn-sm">
          ← Practice Lobby
        </Link>
        <h1 className="practice-lobby-title">Waiting Room</h1>
        <div style={{ width: 60 }} />
      </div>

      <div className="card stack" style={{ padding: 24, marginTop: 12 }}>
        <div className="pulse-icon" style={{ fontSize: 48 }}>🎮</div>
        <h2>Searching for Opponent...</h2>
        <p className="text-muted" style={{ fontSize: 13 }}>
          Share your room code with a friend or wait for another player to join.
        </p>

        <div className="room-code-display-box" style={{ background: "#f1f5f9", padding: "16px", borderRadius: 12, border: "2px dashed #0a51e1", margin: "16px 0" }}>
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textTransform: "uppercase", display: "block" }}>
            PRACTICE ROOM CODE
          </span>
          <span style={{ fontSize: 28, fontWeight: 900, color: "#0a51e1", letterSpacing: 2 }}>
            {room.code}
          </span>
        </div>

        <div className="row" style={{ justifyContent: "center", gap: 10 }}>
          <button className="btn btn-primary" onClick={handleCopyCode}>
            {copied ? "COPIED!" : "📋 COPY CODE"}
          </button>
          <button className="btn btn-accent" onClick={handleWhatsAppShare} style={{ background: "#25D366", color: "#fff", border: "none" }}>
            💬 SHARE WHATSAPP
          </button>
        </div>
      </div>
    </div>
  );
}
