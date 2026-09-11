// practiceLudoEngine.js — Classic Authoritative 4-Color Ludo Rules Engine

export const SAFE_CELLS = [1, 9, 14, 22, 27, 35, 40, 48];

export const START_CELLS = {
  red: 1,
  green: 14,
  yellow: 27,
  blue: 40,
};

export const GATE_CELLS = {
  red: 51,
  green: 12,
  yellow: 25,
  blue: 38,
};

export const FINISH_CELLS = {
  red: 106,
  green: 206,
  yellow: 306,
  blue: 406,
};

export const STRETCH_BASE = {
  red: 100,
  green: 200,
  yellow: 300,
  blue: 400,
};

export function getStartingPosition(color) {
  return START_CELLS[color] || 1;
}

export function getFinishPosition(color) {
  return FINISH_CELLS[color] || 106;
}

/**
 * Calculates new logical position for a token given color, current position, and dice roll.
 * Returns null if the move is illegal or exceeds home finish.
 */
export function calculateNewPosition(color, currentPos, diceValue) {
  if (diceValue < 1 || diceValue > 6) return null;

  // Token in Home Base (0)
  if (currentPos === 0) {
    if (diceValue === 6) {
      return getStartingPosition(color);
    }
    return null;
  }

  const base = STRETCH_BASE[color];
  const finish = FINISH_CELLS[color];
  const gate = GATE_CELLS[color];

  // Token already inside home stretch
  if (currentPos > base) {
    const nextPos = currentPos + diceValue;
    return nextPos <= finish ? nextPos : null;
  }

  // Token on main common track (1..52)
  if (color === "red") {
    const rawNext = currentPos + diceValue;
    if (rawNext > gate) {
      const stretchStep = rawNext - gate;
      const finalPos = base + stretchStep;
      return finalPos <= finish ? finalPos : null;
    }
    return rawNext;
  }

  // Green, Yellow, Blue (Gate is before 52, wrap around track)
  // Check if token passes gate
  if (currentPos <= gate) {
    const nextPos = currentPos + diceValue;
    if (nextPos > gate) {
      const stretchStep = nextPos - gate;
      const finalPos = base + stretchStep;
      return finalPos <= finish ? finalPos : null;
    }
    return nextPos;
  } else {
    // Current position > gate (e.g. Green token at cell 40 moving towards gate at 12)
    const rawNext = currentPos + diceValue;
    if (rawNext > 52) {
      const wrapped = rawNext - 52;
      if (wrapped > gate) {
        const stretchStep = wrapped - gate;
        const finalPos = base + stretchStep;
        return finalPos <= finish ? finalPos : null;
      }
      return wrapped;
    }
    return rawNext;
  }
}

/**
 * Returns array of tokenId strings ("token1", "token2", etc.) that can legally move with the given dice roll.
 */
export function getMovableTokens(color, playerTokens, diceValue) {
  const movable = [];
  if (!playerTokens) return movable;

  ["token1", "token2", "token3", "token4"].forEach((tokenId) => {
    const currPos = playerTokens[tokenId] ?? 0;
    const newPos = calculateNewPosition(color, currPos, diceValue);
    if (newPos !== null) {
      movable.push(tokenId);
    }
  });
  return movable;
}

/**
 * Checks if a move captures any opponent tokens.
 * Opponent tokens on safe cells or in home stretch/base cannot be captured.
 */
export function processCapture(moverColor, targetPosition, tokenPositions) {
  let captured = false;
  const updatedTokens = { ...tokenPositions };

  // Cannot capture on safe cells, home stretch, or home base
  if (SAFE_CELLS.includes(targetPosition) || targetPosition >= 100 || targetPosition === 0) {
    return { captured: false, updatedTokenPositions: updatedTokens };
  }

  Object.keys(updatedTokens).forEach((color) => {
    if (color !== moverColor && updatedTokens[color]) {
      const colorTokens = { ...updatedTokens[color] };
      ["token1", "token2", "token3", "token4"].forEach((tId) => {
        if (colorTokens[tId] === targetPosition) {
          colorTokens[tId] = 0; // Send captured token back to Home Base!
          captured = true;
        }
      });
      updatedTokens[color] = colorTokens;
    }
  });

  return { captured, updatedTokenPositions: updatedTokens };
}

/**
 * Evaluates whether a player has won by checking if all 4 tokens have reached the Finish cell.
 */
export function checkWinCondition(color, playerTokens) {
  if (!playerTokens) return false;
  const finishPos = getFinishPosition(color);
  return ["token1", "token2", "token3", "token4"].every((tId) => playerTokens[tId] === finishPos);
}
