import { useState, useEffect } from "react";
import "./PracticeDice.css";

const FACE_DOTS = {
  1: ["dot-center"],
  2: ["dot-top-right", "dot-bottom-left"],
  3: ["dot-top-right", "dot-center", "dot-bottom-left"],
  4: ["dot-top-left", "dot-top-right", "dot-bottom-left", "dot-bottom-right"],
  5: ["dot-top-left", "dot-top-right", "dot-center", "dot-bottom-left", "dot-bottom-right"],
  6: ["dot-top-left", "dot-top-right", "dot-mid-left", "dot-mid-right", "dot-bottom-left", "dot-bottom-right"],
};

export default function PracticeDice({
  diceValue = 0,
  disabled = false,
  isMyTurn = false,
  turnColor = "blue",
  onRoll,
}) {
  const [isRolling, setIsRolling] = useState(false);

  // Trigger 3D tumble & bounce animation whenever diceValue updates (for all players)
  useEffect(() => {
    if (diceValue > 0) {
      setIsRolling(true);
      const timer = setTimeout(() => setIsRolling(false), 700);
      return () => clearTimeout(timer);
    }
  }, [diceValue]);

  const handleDiceClick = () => {
    if (disabled || !isMyTurn || isRolling) return;
    setIsRolling(true);
    setTimeout(() => {
      setIsRolling(false);
    }, 700);
    onRoll();
  };

  const frontVal = diceValue > 0 ? diceValue : 6;

  // Opposite faces dice mapping (front + back = 7)
  const faceValues = {
    front: frontVal,
    back: 7 - frontVal,
    right: frontVal === 3 ? 1 : 3,
    left: frontVal === 4 ? 6 : 4,
    top: frontVal === 2 ? 1 : 2,
    bottom: frontVal === 5 ? 6 : 5,
  };

  return (
    <div className="practice-dice-scene">
      <button
        className={`practice-3d-cube-box dice-theme-${turnColor} ${isRolling ? "cube-rolling-anim" : ""} ${
          isMyTurn && !disabled ? "cube-my-turn" : "cube-disabled"
        }`}
        disabled={disabled || !isMyTurn || isRolling}
        onClick={handleDiceClick}
        title={isMyTurn ? "Tap to Roll 3D Cube Dice" : "Opponent's Turn"}
      >
        <div className="cube-inner-wrapper">
          {["front", "back", "right", "left", "top", "bottom"].map((faceSide) => {
            const val = faceValues[faceSide] || 1;
            const dots = FACE_DOTS[val] || [];
            return (
              <div key={faceSide} className={`cube-face face-${faceSide}`}>
                {dots.map((dotClass, idx) => (
                  <span key={idx} className={`dice-dot ${dotClass}`} />
                ))}
              </div>
            );
          })}
        </div>
      </button>
    </div>
  );
}
