import { Router } from "express";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler.js";
import PracticeRoom from "../models/PracticeRoom.js";
import PracticeGame from "../models/PracticeGame.js";
import User from "../models/User.js";
import {
  calculateNewPosition,
  getMovableTokens,
  processCapture,
  checkWinCondition,
} from "../utils/practiceLudoEngine.js";
import { addSubscriber, removeSubscriber, broadcastPracticeState } from "../utils/practiceRealtime.js";

const router = Router();

// Optional Auth Middleware for Practice Mode: Works for both logged-in users and guest players
router.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      if (process.env.JWT_SECRET) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { id: decoded.userId || decoded.id, name: decoded.name || "Player" };
        return next();
      }
    } catch (err) {
      // Token invalid or expired, fallback to guest
    }
  }

  // Guest Player Identity fallback
  const guestId = req.headers["x-guest-id"] || `guest_${Math.floor(100000 + Math.random() * 900000)}`;
  req.user = { id: guestId, name: `Practice Player ${guestId.slice(-4)}` };
  next();
});

function generateRoomCode() {
  // Always 6 numeric digits starting with '0' (e.g. 084912)
  const remainingDigits = String(Math.floor(Math.random() * 100000)).padStart(5, "0");
  return `0${remainingDigits}`;
}

const BOT_USER_ID = "000000000000000000000001";

// 1. POST /api/practice/quick-play — Instantly opens game board with online player or Practice Bot!
router.post(
  "/quick-play",
  asyncHandler(async (req, res) => {
    // 1. Instant Game Creation with Practice Bot / Computer Player (Game board opens IMMEDIATELY)
    const practiceGameId = `practice_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const code = generateRoomCode();

    const newRoom = await PracticeRoom.create({
      code,
      host: req.user.id,
      guest: BOT_USER_ID,
      status: "active",
      gameId: practiceGameId,
    });

    const pair = { p1: "blue", p2: "green" };

    const game = await PracticeGame.create({
      practiceGameId,
      roomId: newRoom._id,
      players: [
        { userId: req.user.id, name: req.user.name || "You", color: pair.p1 },
        { userId: BOT_USER_ID, name: "Practice AI 🤖", color: pair.p2 },
      ],
      currentTurnPlayerId: req.user.id,
      turnExpiresAt: new Date(Date.now() + 60000),
      status: "active",
    });

    res.json({ room: newRoom, gameId: practiceGameId });
  })
);

// 2. POST /api/practice/rooms/create — Create private room code
router.post(
  "/rooms/create",
  asyncHandler(async (req, res) => {
    const code = generateRoomCode();
    const room = await PracticeRoom.create({
      code,
      host: req.user.id,
      status: "waiting",
    });
    res.json({ room });
  })
);

// 3. POST /api/practice/rooms/join — Join room by code
router.post(
  "/rooms/join",
  asyncHandler(async (req, res) => {
    const code = String(req.body.code || "").trim().toUpperCase();
    if (!code) return res.status(400).json({ message: "Room code is required" });

    const room = await PracticeRoom.findOne({ code, status: "waiting" });
    if (!room) {
      return res.status(404).json({ message: "Practice room not found or already started" });
    }

    if (String(room.host) === String(req.user.id)) {
      return res.json({ room });
    }

    room.guest = req.user.id;
    room.status = "active";

    const practiceGameId = `practice_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    room.gameId = practiceGameId;
    await room.save();

    const hostUser = mongoose.Types.ObjectId.isValid(room.host) ? await User.findById(room.host).select("name") : null;

    const pair = { p1: "blue", p2: "green" };

    await PracticeGame.create({
      practiceGameId,
      roomId: room._id,
      players: [
        { userId: room.host, name: hostUser?.name || "Player 1", color: pair.p1 },
        { userId: req.user.id, name: req.user.name || "Player 2", color: pair.p2 },
      ],
      currentTurnPlayerId: room.host,
      turnExpiresAt: new Date(Date.now() + 60000),
      status: "active",
    });

    res.json({ room, gameId: practiceGameId });
  })
);

// 4. GET /api/practice/rooms/available
router.get(
  "/rooms/available",
  asyncHandler(async (req, res) => {
    const rooms = await PracticeRoom.find({ status: "waiting" })
      .populate("host", "name")
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(rooms);
  })
);

// 5. GET /api/practice/rooms/:id
router.get(
  "/rooms/:id",
  asyncHandler(async (req, res) => {
    const room = await PracticeRoom.findById(req.params.id)
      .populate("host", "name")
      .populate("guest", "name");
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json(room);
  })
);

// 6. GET /api/practice/games/:gameId
router.get(
  "/games/:gameId",
  asyncHandler(async (req, res) => {
    const game = await PracticeGame.findOne({ practiceGameId: req.params.gameId });
    if (!game) return res.status(404).json({ message: "Practice game not found" });
    res.json(game);
  })
);

// 7. GET /api/practice/stream/:gameId — SSE Realtime Stream Endpoint
router.get("/stream/:gameId", (req, res) => {
  const { gameId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  addSubscriber(gameId, res);

  req.on("close", () => {
    removeSubscriber(gameId, res);
  });
});

// Helper: Smart AI Token Selection Decision Engine
function chooseBestBotToken(botColor, movableTokenIds, dice, allTokenPositions, humanColor) {
  if (!movableTokenIds || movableTokenIds.length === 0) return null;
  if (movableTokenIds.length === 1) return movableTokenIds[0];

  let bestToken = movableTokenIds[0];
  let highestScore = -Infinity;

  const botTokens = allTokenPositions[botColor] || {};

  for (const tokenId of movableTokenIds) {
    let score = 0;
    const currPos = botTokens[tokenId] ?? 0;
    const newPos = calculateNewPosition(botColor, currPos, dice);

    if (newPos === null) continue;

    // 1. Winning move into Home Finish (pos 57) — Highest Priority
    if (newPos === 57) {
      score += 10000;
    }

    // 2. Capture Opponent Token — Very High Priority
    const { captured } = processCapture(botColor, newPos, allTokenPositions);
    if (captured) {
      score += 5000;
    }

    // 3. Opening token from home base on 6 (pos 0 -> pos 1) — High Priority
    if (currPos === 0 && newPos === 1) {
      score += 3000;
    }

    // 4. Moving into a Safe Spot (Star cell) — Good Priority
    const isSafeSpot = [1, 9, 14, 22, 27, 35, 40, 48].includes(newPos);
    if (isSafeSpot) {
      score += 2000;
    }

    // 5. Escaping Danger (if current position was vulnerable)
    const isCurrSafe = [0, 1, 9, 14, 22, 27, 35, 40, 48].includes(currPos);
    if (!isCurrSafe && currPos > 0) {
      score += 800;
    }

    // 6. Progressive movement towards home (further position gets higher score)
    score += newPos * 10;

    if (score > highestScore) {
      highestScore = score;
      bestToken = tokenId;
    }
  }

  return bestToken;
}

// Helper: Automates Practice AI Bot Turn with 2-Step Live Animation (Roll -> Pause -> Move)
async function triggerBotTurnIfNecessary(game) {
  if (!game || game.status !== "active") return;
  if (String(game.currentTurnPlayerId) !== BOT_USER_ID) return;

  // Step 1: Human-like thinking delay before rolling dice (700ms)
  setTimeout(async () => {
    try {
      const liveGame = await PracticeGame.findOne({ practiceGameId: game.practiceGameId });
      if (!liveGame || liveGame.status !== "active") return;
      if (String(liveGame.currentTurnPlayerId) !== BOT_USER_ID) return;

      const botPlayer = liveGame.players.find((p) => String(p.userId) === BOT_USER_ID);
      const botColor = botPlayer?.color || "yellow";
      const humanPlayer = liveGame.players.find((p) => String(p.userId) !== BOT_USER_ID);
      const humanColor = humanPlayer?.color || "red";

      // AI rolls the dice
      const dice = Math.floor(Math.random() * 6) + 1;
      const movableTokenIds = getMovableTokens(botColor, liveGame.tokenPositions[botColor], dice);

      // Broadcast AI Dice Roll state to client so human sees AI's 3D dice roll on screen!
      liveGame.diceValue = dice;
      liveGame.diceRolled = true;
      liveGame.movableTokenIds = movableTokenIds;
      liveGame.lastMoveText = `${botPlayer?.name || "Practice AI 🤖"} rolled a ${dice}`;
      liveGame.stateVersion += 1;
      await liveGame.save();

      broadcastPracticeState(liveGame.practiceGameId, liveGame);

      // If no valid moves for AI:
      if (movableTokenIds.length === 0) {
        setTimeout(async () => {
          const gameAfterPass = await PracticeGame.findOne({ practiceGameId: liveGame.practiceGameId });
          if (!gameAfterPass || gameAfterPass.status !== "active") return;

          let nextTurn = humanPlayer ? humanPlayer.userId : BOT_USER_ID;
          if (dice === 6) {
            nextTurn = BOT_USER_ID; // 6 gets another roll
          }

          gameAfterPass.diceRolled = false;
          gameAfterPass.diceValue = 0;
          gameAfterPass.movableTokenIds = [];
          gameAfterPass.currentTurnPlayerId = nextTurn;
          gameAfterPass.turnExpiresAt = new Date(Date.now() + 60000);
          gameAfterPass.lastMoveText = `${botPlayer?.name || "Practice AI 🤖"} rolled ${dice} (No valid moves)`;
          gameAfterPass.stateVersion += 1;
          await gameAfterPass.save();

          broadcastPracticeState(gameAfterPass.practiceGameId, gameAfterPass);

          if (nextTurn === BOT_USER_ID && gameAfterPass.status === "active") {
            triggerBotTurnIfNecessary(gameAfterPass);
          }
        }, 900);
        return;
      }

      // Step 2: Pause after dice roll (950ms) so human sees AI's dice roll before AI moves token!
      setTimeout(async () => {
        const gameToMove = await PracticeGame.findOne({ practiceGameId: liveGame.practiceGameId });
        if (!gameToMove || gameToMove.status !== "active") return;

        // Intelligent AI Token Selection Decision:
        const bestTokenId = chooseBestBotToken(botColor, movableTokenIds, dice, gameToMove.tokenPositions, humanColor);

        const currPos = gameToMove.tokenPositions[botColor][bestTokenId] ?? 0;
        const newPos = calculateNewPosition(botColor, currPos, dice);

        if (newPos === null) return;

        gameToMove.tokenPositions[botColor][bestTokenId] = newPos;

        const { captured, updatedOpponentTokens } = processCapture(botColor, newPos, gameToMove.tokenPositions);
        if (captured && humanPlayer) {
          gameToMove.tokenPositions[humanPlayer.color] = updatedOpponentTokens;
        }

        const isWin = checkWinCondition(botColor, gameToMove.tokenPositions[botColor]);

        let nextTurn = humanPlayer ? humanPlayer.userId : BOT_USER_ID;
        let moveDetail = "";

        if (isWin) {
          gameToMove.status = "completed";
          gameToMove.winner = BOT_USER_ID;
          gameToMove.lastMoveText = `🏆 Practice AI 🤖 WON THE PRACTICE MATCH!`;
        } else {
          if (dice === 6 || captured || newPos === 57) {
            nextTurn = BOT_USER_ID; // AI gets extra turn for 6, capture, or finish!
            moveDetail = captured ? " (Captured your token! Extra turn!)" : newPos === 57 ? " (Reached Finish! Extra turn!)" : " (Rolled 6! Extra turn!)";
          }
          gameToMove.lastMoveText = `Practice AI 🤖 moved ${bestTokenId} to ${newPos}${moveDetail}`;
        }

        gameToMove.currentTurnPlayerId = nextTurn;
        gameToMove.diceRolled = false;
        gameToMove.diceValue = 0;
        gameToMove.movableTokenIds = [];
        gameToMove.turnExpiresAt = new Date(Date.now() + 60000);
        gameToMove.turnNumber += 1;
        gameToMove.stateVersion += 1;
        await gameToMove.save();

        broadcastPracticeState(gameToMove.practiceGameId, gameToMove);

        // If AI gets extra turn, continue AI turn loop
        if (nextTurn === BOT_USER_ID && gameToMove.status === "active") {
          triggerBotTurnIfNecessary(gameToMove);
        }
      }, 950);

    } catch (err) {
      console.error("Bot turn execution error:", err);
    }
  }, 700);
}

// 8. POST /api/practice/games/:gameId/roll-dice — Authoritative Dice Roll
router.post(
  "/games/:gameId/roll-dice",
  asyncHandler(async (req, res) => {
    const game = await PracticeGame.findOne({ practiceGameId: req.params.gameId });
    if (!game) return res.status(404).json({ message: "Game not found" });

    if (game.status !== "active") {
      return res.status(400).json({ message: "Game is already finished" });
    }

    if (String(game.currentTurnPlayerId) !== String(req.user.id)) {
      return res.status(403).json({ message: "It is not your turn" });
    }

    if (game.diceRolled) {
      return res.status(400).json({ message: "Dice already rolled for this turn" });
    }

    const player = game.players.find((p) => String(p.userId) === String(req.user.id));
    const opponent = game.players.find((p) => String(p.userId) !== String(req.user.id));

    const dice = Math.floor(Math.random() * 6) + 1;
    const playerColor = player.color;

    const movableTokenIds = getMovableTokens(playerColor, game.tokenPositions[playerColor], dice);

    if (movableTokenIds.length === 0) {
      let nextTurnPlayerId = opponent.userId;
      let moveText = `${player.name} rolled ${dice} (No valid moves)`;

      if (dice === 6) {
        nextTurnPlayerId = player.userId;
        moveText = `${player.name} rolled 6! Roll again.`;
      }

      game.diceValue = dice;
      game.diceRolled = false;
      game.movableTokenIds = [];
      game.currentTurnPlayerId = nextTurnPlayerId;
      game.turnExpiresAt = new Date(Date.now() + 60000);
      game.lastMoveText = moveText;
      game.stateVersion += 1;
      await game.save();

      broadcastPracticeState(req.params.gameId, game);

      if (nextTurnPlayerId === BOT_USER_ID) {
        triggerBotTurnIfNecessary(game);
      }

      return res.json(game);
    }

    game.diceValue = dice;
    game.diceRolled = true;
    game.movableTokenIds = movableTokenIds;
    game.lastMoveText = `${player.name} rolled a ${dice}`;
    game.stateVersion += 1;
    await game.save();

    broadcastPracticeState(req.params.gameId, game);
    res.json(game);
  })
);

// 9. POST /api/practice/games/:gameId/move-token — Authoritative Token Move
router.post(
  "/games/:gameId/move-token",
  asyncHandler(async (req, res) => {
    const { tokenId } = req.body;
    if (!tokenId) return res.status(400).json({ message: "Token ID is required" });

    const game = await PracticeGame.findOne({ practiceGameId: req.params.gameId });
    if (!game) return res.status(404).json({ message: "Game not found" });

    if (game.status !== "active") {
      return res.status(400).json({ message: "Game is already finished" });
    }

    if (String(game.currentTurnPlayerId) !== String(req.user.id)) {
      return res.status(403).json({ message: "It is not your turn" });
    }

    if (!game.diceRolled) {
      return res.status(400).json({ message: "Please roll the dice first" });
    }

    if (!game.movableTokenIds.includes(tokenId)) {
      return res.status(400).json({ message: "Selected token cannot be legally moved" });
    }

    const player = game.players.find((p) => String(p.userId) === String(req.user.id));
    const opponent = game.players.find((p) => String(p.userId) !== String(req.user.id));
    const playerColor = player.color;

    const currPos = game.tokenPositions[playerColor][tokenId] ?? 0;
    const newPos = calculateNewPosition(playerColor, currPos, game.diceValue);

    if (newPos === null) {
      return res.status(400).json({ message: "Invalid movement calculation" });
    }

    game.tokenPositions[playerColor][tokenId] = newPos;

    const { captured, updatedOpponentTokens } = processCapture(
      playerColor,
      newPos,
      game.tokenPositions
    );
    if (captured) {
      game.tokenPositions[opponent.color] = updatedOpponentTokens;
    }

    const isWin = checkWinCondition(playerColor, game.tokenPositions[playerColor]);

    let nextTurnPlayerId = opponent.userId;
    let extraTurn = false;

    if (isWin) {
      game.status = "completed";
      game.winner = player.userId;
      game.lastMoveText = `🏆 ${player.name} WON THE PRACTICE MATCH!`;
    } else {
      if (game.diceValue === 6 || captured || newPos === 57) {
        extraTurn = true;
        nextTurnPlayerId = player.userId;
      }

      const moveDetail = captured
        ? ` (Captured opponent token!)`
        : newPos === 57
        ? ` (Reached Finish! Extra turn!)`
        : extraTurn
        ? ` (Extra turn!)`
        : "";
      game.lastMoveText = `${player.name} moved ${tokenId} to position ${newPos}${moveDetail}`;
    }

    game.currentTurnPlayerId = nextTurnPlayerId;
    game.diceRolled = false;
    game.diceValue = 0;
    game.movableTokenIds = [];
    game.turnExpiresAt = new Date(Date.now() + 60000);
    game.turnNumber += 1;
    game.stateVersion += 1;
    await game.save();

    broadcastPracticeState(req.params.gameId, game);

    if (nextTurnPlayerId === BOT_USER_ID) {
      triggerBotTurnIfNecessary(game);
    }

    res.json(game);
  })
);

// 10. POST /api/practice/games/:gameId/skip-turn
router.post(
  "/games/:gameId/skip-turn",
  asyncHandler(async (req, res) => {
    const game = await PracticeGame.findOne({ practiceGameId: req.params.gameId });
    if (!game || game.status !== "active") return res.status(404).json({ message: "Game not active" });

    if (String(game.currentTurnPlayerId) !== String(req.user.id)) {
      return res.status(403).json({ message: "Not your turn" });
    }

    const playerIndex = game.players.findIndex(p => String(p.userId) === String(req.user.id));
    if (playerIndex > -1) {
      game.players[playerIndex].lives -= 1;
      
      if (game.players[playerIndex].lives <= 0) {
        game.status = "completed";
        const opponent = game.players.find(p => String(p.userId) !== String(req.user.id));
        game.winner = opponent ? opponent.userId : BOT_USER_ID;
        game.lastMoveText = `Timeout! ${game.players[playerIndex].name} ran out of lives and lost.`;
        game.stateVersion += 1;
        await game.save();
        broadcastPracticeState(req.params.gameId, game);
        return res.json(game);
      }
    }

    const opponent = game.players.find((p) => String(p.userId) !== String(req.user.id));
    game.currentTurnPlayerId = opponent.userId;
    game.diceRolled = false;
    game.diceValue = 0;
    game.movableTokenIds = [];
    game.turnExpiresAt = new Date(Date.now() + 60000);
    game.turnNumber += 1;
    game.lastMoveText = `${req.user.name} ran out of time and skipped their turn.`;
    game.stateVersion += 1;
    await game.save();

    broadcastPracticeState(req.params.gameId, game);

    if (opponent.userId === BOT_USER_ID) {
      triggerBotTurnIfNecessary(game);
    }

    res.json(game);
  })
);

// 11. POST /api/practice/games/:gameId/leave
router.post(
  "/games/:gameId/leave",
  asyncHandler(async (req, res) => {
    const game = await PracticeGame.findOne({ practiceGameId: req.params.gameId });
    if (!game || game.status !== "active") return res.status(404).json({ message: "Game not active" });

    const player = game.players.find(p => String(p.userId) === String(req.user.id));
    const opponent = game.players.find(p => String(p.userId) !== String(req.user.id));
    
    if (!player) return res.status(403).json({ message: "You are not in this game" });

    game.status = "completed";
    game.winner = opponent ? opponent.userId : BOT_USER_ID;
    game.lastMoveText = `${player.name} left the match. Opponent wins!`;
    game.stateVersion += 1;
    await game.save();

    broadcastPracticeState(req.params.gameId, game);
    res.json(game);
  })
);

export default router;
