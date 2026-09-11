import { io } from "socket.io-client";
import { API_BASE_URL } from "./apiClient.js";

const SOCKET_SERVER_URL = API_BASE_URL.replace(/\/api\/?$/, "");

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_SERVER_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      console.log("⚡ Socket.IO Connected to Server:", socket.id);
    });

    socket.on("connect_error", (err) => {
      console.warn("Socket.IO Connection Error:", err.message);
    });
  }

  return socket;
}

export function subscribeUserRoom(userId) {
  const s = getSocket();
  if (userId) {
    s.emit("join:user", userId);
  }
}

export function subscribeLobbyRoom() {
  const s = getSocket();
  s.emit("join:lobby");
}

export function subscribeMatchRoom(matchId) {
  const s = getSocket();
  if (matchId) {
    s.emit("join:match", matchId);
  }
}

export function leaveMatchRoom(matchId) {
  const s = getSocket();
  if (matchId) {
    s.emit("leave:match", matchId);
  }
}
