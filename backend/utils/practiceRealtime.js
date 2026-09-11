// practiceRealtime.js — Server-Sent Events (SSE) Realtime Subscriber Manager

const subscribers = new Map(); // gameId -> Set of Express Response objects

export function addSubscriber(gameId, res) {
  if (!subscribers.has(gameId)) {
    subscribers.set(gameId, new Set());
  }
  subscribers.get(gameId).add(res);
}

export function removeSubscriber(gameId, res) {
  if (subscribers.has(gameId)) {
    const gameSubs = subscribers.get(gameId);
    gameSubs.delete(res);
    if (gameSubs.size === 0) {
      subscribers.delete(gameId);
    }
  }
}

export function broadcastPracticeState(gameId, gameState) {
  if (!subscribers.has(gameId)) return;

  const payload = `event: state_update\ndata: ${JSON.stringify(gameState)}\n\n`;
  const gameSubs = subscribers.get(gameId);

  gameSubs.forEach((res) => {
    try {
      res.write(payload);
    } catch (err) {
      gameSubs.delete(res);
    }
  });
}
