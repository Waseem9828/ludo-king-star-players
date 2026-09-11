import { Server } from "socket.io";
import redisWrapper from "./redis.js";

let io = null;

export function initSocket(server) {
  const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map(s => s.trim()) : "*";

  io = new Server(server, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Attach Redis Adapter if Redis is connected
  if (redisWrapper.isConnected && redisWrapper.client) {
    try {
      import("@socket.io/redis-adapter").then(({ createAdapter }) => {
        const pubClient = redisWrapper.client.duplicate();
        const subClient = redisWrapper.client.duplicate();
        io.adapter(createAdapter(pubClient, subClient));
        console.log("⚡ Socket.io Redis Adapter attached for multi-cluster scaling.");
      }).catch((e) => {
        console.warn("Socket.io Redis adapter optional import skipped.");
      });
    } catch (e) {
      // Redis adapter optional
    }
  }

  io.on("connection", (socket) => {
    // Player joins personal room for wallet & private notification updates
    socket.on("join:user", (userId) => {
      if (userId && typeof userId === "string" && /^[a-fA-F0-9]{24}$/.test(userId)) {
        socket.join(`user:${userId}`);
      }
    });

    // Player joins a specific match room for live match events
    socket.on("join:match", (matchId) => {
      if (matchId && typeof matchId === "string" && /^[a-fA-F0-9]{24}$/.test(matchId)) {
        socket.join(`match:${matchId}`);
      }
    });

    socket.on("leave:match", (matchId) => {
      if (matchId && typeof matchId === "string" && /^[a-fA-F0-9]{24}$/.test(matchId)) {
        socket.leave(`match:${matchId}`);
      }
    });

    // Join active lobby stream
    socket.on("join:lobby", () => {
      socket.join("lobby:matches");
    });

    socket.on("disconnect", () => {
      // Clean disconnect
    });
  });

  return io;
}

export function getIO() {
  return io;
}

/**
 * Broadcast event to a specific user
 */
export function notifyUser(userId, event, data) {
  if (io && userId) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

/**
 * Broadcast event to participants in a specific match room
 */
export function notifyMatch(matchId, event, data) {
  if (io && matchId) {
    io.to(`match:${matchId}`).emit(event, data);
  }
}

/**
 * Broadcast event to active lobby
 */
export function notifyLobby(event, data) {
  if (io) {
    io.to("lobby:matches").emit(event, data);
  }
}
