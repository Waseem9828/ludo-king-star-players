import mongoose from "mongoose";

const practiceGameSchema = new mongoose.Schema(
  {
    practiceGameId: { type: String, required: true, unique: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "PracticeRoom" },
    players: [
      {
        userId: { type: String, required: true },
        name: { type: String, default: "Player" },
        color: { type: String, enum: ["red", "green", "yellow", "blue"], required: true },
        connected: { type: Boolean, default: true },
        lastActive: { type: Date, default: Date.now },
        lives: { type: Number, default: 3 },
      },
    ],
    currentTurnPlayerId: { type: String, required: true },
    diceValue: { type: Number, default: 0 },
    diceRolled: { type: Boolean, default: false },
    movableTokenIds: [{ type: String }],
    tokenPositions: {
      red: {
        token1: { type: Number, default: 0 }, // 0 = Home Base, 1..52 = Track, 101..106 = Home Stretch/Finish
        token2: { type: Number, default: 0 },
        token3: { type: Number, default: 0 },
        token4: { type: Number, default: 0 },
      },
      green: {
        token1: { type: Number, default: 0 }, // 0 = Home Base, 1..52 = Track, 201..206 = Home Stretch/Finish
        token2: { type: Number, default: 0 },
        token3: { type: Number, default: 0 },
        token4: { type: Number, default: 0 },
      },
      yellow: {
        token1: { type: Number, default: 0 }, // 0 = Home Base, 1..52 = Track, 301..306 = Home Stretch/Finish
        token2: { type: Number, default: 0 },
        token3: { type: Number, default: 0 },
        token4: { type: Number, default: 0 },
      },
      blue: {
        token1: { type: Number, default: 0 }, // 0 = Home Base, 1..52 = Track, 401..406 = Home Stretch/Finish
        token2: { type: Number, default: 0 },
        token3: { type: Number, default: 0 },
        token4: { type: Number, default: 0 },
      },
    },
    status: { type: String, enum: ["active", "completed"], default: "active" },
    winner: { type: String, default: null },
    turnNumber: { type: Number, default: 1 },
    turnExpiresAt: { type: Date },
    lastMoveText: { type: String, default: "Practice Match Started" },
    stateVersion: { type: Number, default: 1 },
  },
  { timestamps: true }
);

practiceGameSchema.index({ status: 1, updatedAt: -1 });

export default mongoose.model("PracticeGame", practiceGameSchema);
