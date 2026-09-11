import { useNavigate } from "react-router-dom";
import Modal from "../../components/Modal.jsx";

export default function PracticeResultModal({ isOpen, winnerName, isWinnerMe, onPlayAgain }) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={() => navigate("/practice")} title="🏆 Practice Match Complete">
      <div className="stack text-center" style={{ padding: 12 }}>
        <div style={{ fontSize: 54, margin: "8px 0" }}>
          {isWinnerMe ? "🎉" : "🤝"}
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 800, color: isWinnerMe ? "#10b981" : "#0f172a" }}>
          {isWinnerMe ? "YOU WON!" : `${winnerName || "Opponent"} Won!`}
        </h2>

        <p className="text-muted" style={{ fontSize: 13 }}>
          Great match! This was a free practice match — no chips or wallet balance were affected.
        </p>

        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <button className="btn btn-secondary flex-1" onClick={() => navigate("/practice")}>
            Practice Lobby
          </button>
          <button className="btn btn-primary flex-1" onClick={onPlayAgain}>
            Play Again
          </button>
        </div>
      </div>
    </Modal>
  );
}
