import "./PracticeBoard.css";

// 15x15 Ludo Track Coordinate Map for cells 1..52
const TRACK_COORDINATES = {
  1: { r: 6, c: 1 }, 2: { r: 6, c: 2 }, 3: { r: 6, c: 3 }, 4: { r: 6, c: 4 }, 5: { r: 6, c: 5 },
  6: { r: 5, c: 6 }, 7: { r: 4, c: 6 }, 8: { r: 3, c: 6 }, 9: { r: 2, c: 6 }, 10: { r: 1, c: 6 }, 11: { r: 0, c: 6 },
  12: { r: 0, c: 7 }, 13: { r: 0, c: 8 },
  14: { r: 1, c: 8 }, 15: { r: 2, c: 8 }, 16: { r: 3, c: 8 }, 17: { r: 4, c: 8 }, 18: { r: 5, c: 8 },
  19: { r: 6, c: 9 }, 20: { r: 6, c: 10 }, 21: { r: 6, c: 11 }, 22: { r: 6, c: 12 }, 23: { r: 6, c: 13 }, 24: { r: 6, c: 14 },
  25: { r: 7, c: 14 }, 26: { r: 8, c: 14 },
  27: { r: 8, c: 13 }, 28: { r: 8, c: 12 }, 29: { r: 8, c: 11 }, 30: { r: 8, c: 10 }, 31: { r: 8, c: 9 },
  32: { r: 9, c: 8 }, 33: { r: 10, c: 8 }, 34: { r: 11, c: 8 }, 35: { r: 12, c: 8 }, 36: { r: 13, c: 8 }, 37: { r: 14, c: 8 },
  38: { r: 14, c: 7 }, 39: { r: 14, c: 6 },
  40: { r: 13, c: 6 }, 41: { r: 12, c: 6 }, 42: { r: 11, c: 6 }, 43: { r: 10, c: 6 }, 44: { r: 9, c: 6 },
  45: { r: 8, c: 5 }, 46: { r: 8, c: 4 }, 47: { r: 8, c: 3 }, 48: { r: 8, c: 2 }, 49: { r: 8, c: 1 }, 50: { r: 8, c: 0 },
  51: { r: 7, c: 0 }, 52: { r: 6, c: 0 }
};

// Home Stretches
const STRETCH_COORDINATES = {
  // Red Stretch (101..106)
  101: { r: 7, c: 1 }, 102: { r: 7, c: 2 }, 103: { r: 7, c: 3 }, 104: { r: 7, c: 4 }, 105: { r: 7, c: 5 }, 106: { r: 7, c: 6 },
  // Green Stretch (201..206)
  201: { r: 1, c: 7 }, 202: { r: 2, c: 7 }, 203: { r: 3, c: 7 }, 204: { r: 4, c: 7 }, 205: { r: 5, c: 7 }, 206: { r: 6, c: 7 },
  // Yellow Stretch (301..306)
  301: { r: 7, c: 13 }, 302: { r: 7, c: 12 }, 303: { r: 7, c: 11 }, 304: { r: 7, c: 10 }, 305: { r: 7, c: 9 }, 306: { r: 7, c: 8 },
  // Blue Stretch (401..406)
  401: { r: 13, c: 7 }, 402: { r: 12, c: 7 }, 403: { r: 11, c: 7 }, 404: { r: 10, c: 7 }, 405: { r: 9, c: 7 }, 406: { r: 8, c: 7 },
};

// Base Spots (Spaced comfortably inside white yard: Red Top-Left, Green Top-Right, Blue Bottom-Left, Yellow Bottom-Right)
const BASE_SPOTS = {
  red: {
    token1: { r: 2, c: 2 }, token2: { r: 2, c: 3 }, token3: { r: 3, c: 2 }, token4: { r: 3, c: 3 }
  },
  green: {
    token1: { r: 2, c: 11 }, token2: { r: 2, c: 12 }, token3: { r: 3, c: 11 }, token4: { r: 3, c: 12 }
  },
  blue: {
    token1: { r: 11, c: 2 }, token2: { r: 11, c: 3 }, token3: { r: 12, c: 2 }, token4: { r: 12, c: 3 }
  },
  yellow: {
    token1: { r: 11, c: 11 }, token2: { r: 11, c: 12 }, token3: { r: 12, c: 11 }, token4: { r: 12, c: 12 }
  }
};

const BASE_CIRCLE_KEYS = {
  "2-2": "red", "2-3": "red", "3-2": "red", "3-3": "red",
  "2-11": "green", "2-12": "green", "3-11": "green", "3-12": "green",
  "11-2": "blue", "11-3": "blue", "12-2": "blue", "12-3": "blue",
  "11-11": "yellow", "11-12": "yellow", "12-11": "yellow", "12-12": "yellow"
};

const SAFE_KEYS = ["6-1", "1-8", "8-13", "13-6", "2-6", "6-12", "12-8", "8-2"];

export default function PracticeBoard({
  tokenPositions = {},
  movableTokenIds = [],
  myColor,
  isMyTurn,
  currentTurnColor,
  onSelectToken,
  playerNames = {},
  activeColors,
}) {
  const cellTokensMap = {};

  // Determine active colors playing in the game
  const activeColorList =
    Array.isArray(activeColors) && activeColors.length > 0
      ? activeColors
      : Object.keys(playerNames).length > 0
      ? Object.keys(playerNames)
      : ["red", "green", "blue", "yellow"];

  const addTokenToMap = (color, tokenId, pos) => {
    let coords = null;
    if (pos === 0) {
      coords = BASE_SPOTS[color]?.[tokenId];
    } else if (pos >= 100) {
      coords = STRETCH_COORDINATES[pos];
    } else {
      coords = TRACK_COORDINATES[pos];
    }

    if (coords) {
      const key = `${coords.r}-${coords.c}`;
      if (!cellTokensMap[key]) cellTokensMap[key] = [];
      cellTokensMap[key].push({ color, tokenId, pos });
    }
  };

  // Render tokens ONLY for active players
  activeColorList.forEach((color) => {
    const tokens = tokenPositions[color] || {};
    ["token1", "token2", "token3", "token4"].forEach((tId) => {
      const pos = tokens[tId] ?? 0;
      addTokenToMap(color, tId, pos);
    });
  });

  const cells = [];
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      let cellType = "track";

      // Match Screenshot: Top-Left Red, Top-Right Green, Bottom-Left Blue, Bottom-Right Yellow
      if (r <= 5 && c <= 5) cellType = "yard-red";
      else if (r <= 5 && c >= 9) cellType = "yard-green";
      else if (r >= 9 && c <= 5) cellType = "yard-blue";
      else if (r >= 9 && c >= 9) cellType = "yard-yellow";
      // Center Finish Triangle Area
      else if (r >= 6 && r <= 8 && c >= 6 && c <= 8) cellType = "center-finish";
      // Home Stretches
      else if (r === 7 && c >= 1 && c <= 5) cellType = "stretch-red";
      else if (c === 7 && r >= 1 && r <= 5) cellType = "stretch-green";
      else if (r === 7 && c >= 9 && c <= 13) cellType = "stretch-yellow";
      else if (c === 7 && r >= 9 && r <= 13) cellType = "stretch-blue";
      // Starting Cells
      else if (r === 6 && c === 1) cellType = "start-red";
      else if (r === 1 && c === 8) cellType = "start-green";
      else if (r === 8 && c === 13) cellType = "start-yellow";
      else if (r === 13 && c === 6) cellType = "start-blue";

      const key = `${r}-${c}`;
      const tokensOnCell = cellTokensMap[key] || [];
      const isSafeCell = SAFE_KEYS.includes(key);
      const rawBaseCircleColor = BASE_CIRCLE_KEYS[key];
      const baseCircleColor = rawBaseCircleColor && activeColorList.includes(rawBaseCircleColor) ? rawBaseCircleColor : null;

      cells.push({
        r,
        c,
        key,
        cellType,
        isSafeCell,
        baseCircleColor,
        tokensOnCell,
      });
    }
  }

  return (
    <div className="ludo-king-board-container">
      {/* SVG Gradient Definitions for 3D MPC Round Coins */}
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          {/* 3D Red Coin Gradients */}
          <radialGradient id="3d-coin-red" cx="35%" cy="30%" r="68%">
            <stop offset="0%" stopColor="#ff8a8a" />
            <stop offset="35%" stopColor="#ef4444" />
            <stop offset="80%" stopColor="#b91c1c" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </radialGradient>

          {/* 3D Green Coin Gradients */}
          <radialGradient id="3d-coin-green" cx="35%" cy="30%" r="68%">
            <stop offset="0%" stopColor="#a7f3d0" />
            <stop offset="35%" stopColor="#22c55e" />
            <stop offset="80%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#14532d" />
          </radialGradient>

          {/* 3D Blue Coin Gradients */}
          <radialGradient id="3d-coin-blue" cx="35%" cy="30%" r="68%">
            <stop offset="0%" stopColor="#bfdbfe" />
            <stop offset="35%" stopColor="#3b82f6" />
            <stop offset="80%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </radialGradient>

          {/* 3D Yellow Coin Gradients */}
          <radialGradient id="3d-coin-yellow" cx="35%" cy="30%" r="68%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="35%" stopColor="#eab308" />
            <stop offset="80%" stopColor="#ca8a04" />
            <stop offset="100%" stopColor="#713f12" />
          </radialGradient>
        </defs>
      </svg>

      <div className="ludo-king-board">
        {cells.map(({ r, c, key, cellType, isSafeCell, baseCircleColor, tokensOnCell }) => {
          const isTurnYard = currentTurnColor && cellType === `yard-${currentTurnColor}`;
          const isInnerWhiteYard =
            (r >= 1 && r <= 4 && c >= 1 && c <= 4) ||
            (r >= 1 && r <= 4 && c >= 10 && c <= 13) ||
            (r >= 10 && r <= 13 && c >= 1 && c <= 4) ||
            (r >= 10 && r <= 13 && c >= 10 && c <= 13);
          const isCenterLogoCell = key === "7-7";

          return (
            <div
              key={key}
              className={`ludo-cell cell-${cellType} ${isTurnYard ? "yard-blinking" : ""} ${isInnerWhiteYard ? "inner-white-yard" : ""} ${isCenterLogoCell ? "center-logo-cell" : ""}`}
            >
              {/* Start Entry Arrows matching screenshot */}
              {key === "7-0" && <span className="entry-arrow">→</span>}
              {key === "0-7" && <span className="entry-arrow">↓</span>}
              {key === "7-14" && <span className="entry-arrow">←</span>}
              {key === "14-7" && <span className="entry-arrow">↑</span>}

              {/* Safe Spot Star Icon */}
              {isSafeCell && <span className="ludo-star-icon">☆</span>}

              {/* Permanent Base Spot Circle matching screenshot */}
              {baseCircleColor && <span className={`base-circle spot-${baseCircleColor}`} />}

              {/* Yard Color Area Player Name Labels — INSIDE Game Board (Top Z-Index Layer) */}
              {key === "0-0" && playerNames.red && (
                <div className="yard-label-container yard-label-top-red">
                  <span className="yard-label yard-label-red">{playerNames.red}</span>
                </div>
              )}
              {key === "0-9" && playerNames.green && (
                <div className="yard-label-container yard-label-top-green">
                  <span className="yard-label yard-label-green">{playerNames.green}</span>
                </div>
              )}
              {key === "14-0" && playerNames.blue && (
                <div className="yard-label-container yard-label-bottom-blue">
                  <span className="yard-label yard-label-blue">{playerNames.blue}</span>
                </div>
              )}
              {key === "14-9" && playerNames.yellow && (
                <div className="yard-label-container yard-label-bottom-yellow">
                  <span className="yard-label yard-label-yellow">{playerNames.yellow}</span>
                </div>
              )}

              {/* App Logo in Board Center Area */}
              {key === "7-7" && (
                <div className="center-board-logo-wrap">
                  <img src="/icon-192.png" alt="App Logo" className="center-board-logo-img" />
                </div>
              )}

              {/* 3D Round Coin Tokens with MPC Inscription — Smart Stacking & Sizing */}
              {tokensOnCell.length > 0 && (() => {
                const isMulti = tokensOnCell.length > 1;

                // Sort so active turn or movable tokens render on top (last in DOM array)
                const sortedTokens = [...tokensOnCell].sort((a, b) => {
                  const isAMov = isMyTurn && a.color === myColor && movableTokenIds.includes(a.tokenId);
                  const isBMov = isMyTurn && b.color === myColor && movableTokenIds.includes(b.tokenId);
                  if (isAMov && !isBMov) return 1;
                  if (!isAMov && isBMov) return -1;
                  const isATurn = a.color === currentTurnColor;
                  const isBTurn = b.color === currentTurnColor;
                  if (isATurn && !isBTurn) return 1;
                  if (!isATurn && isBTurn) return -1;
                  return 0;
                });

                return (
                  <div className={`token-stack count-${tokensOnCell.length}`}>
                    {sortedTokens.map(({ color, tokenId, pos }, idx) => {
                      const isMovable = isMyTurn && color === myColor && movableTokenIds.includes(tokenId);
                      const isTurnToken = color === currentTurnColor;
                      const isBaseToken = pos === 0;
                      const textFill = color === "yellow" ? "#0f172a" : "#ffffff";

                      // Stack offsets and scale classes
                      let stackClass = "";
                      let stackStyle = {};

                      if (isBaseToken) {
                        stackClass = "pin-pawn-base";
                      } else if (isMulti) {
                        if (isMovable || isTurnToken) {
                          stackClass = "pin-pawn-active-turn";
                          stackStyle = { zIndex: 25 + idx, transform: `translate(${idx * 3}px, ${-idx * 3}px) scale(1.12)` };
                        } else {
                          stackClass = "pin-pawn-stacked-passive";
                          stackStyle = { zIndex: 10 + idx, transform: `translate(${-idx * 2.5}px, ${idx * 2.5}px) scale(0.82)` };
                        }
                      } else {
                        stackClass = "pin-pawn-track-single";
                      }

                      return (
                        <button
                          key={`${color}-${tokenId}`}
                          className={`ludo-pin-pawn token-pawn-${color} ${stackClass} ${isMovable ? "movable-pulse-glow" : ""}`}
                          style={stackStyle}
                          disabled={!isMovable}
                          onClick={() => isMovable && onSelectToken(tokenId)}
                          title={`${color.toUpperCase()} ${tokenId}`}
                        >
                          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                            {/* 3D Coin Body */}
                            <circle cx="16" cy="16" r="14" fill={`url(#3d-coin-${color})`} stroke="#ffffff" strokeWidth="1.5" />
                            {/* Inner Dashed Metallic Ring */}
                            <circle cx="16" cy="16" r="11" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1" strokeDasharray="3 1.5" />
                            {/* Glossy Specular Highlight Curve */}
                            <path d="M 5 13 A 12 12 0 0 1 27 13 A 12 9 0 0 0 5 13 Z" fill="#ffffff" opacity="0.32" />
                            {/* Center "MPC" Inscription */}
                            <text
                              x="16"
                              y="17.2"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize="9"
                              fontWeight="900"
                              fill={textFill}
                              letterSpacing="0.4"
                            >
                              MPC
                            </text>
                          </svg>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
