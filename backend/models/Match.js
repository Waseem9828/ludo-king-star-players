import mongoose from "mongoose";

export const MATCH_STATUS = Object.freeze({
  WAITING: "WAITING",
  JOINED: "JOINED",
  ACCEPTED: "ACCEPTED",
  ROOM_SHARED: "ROOM_SHARED",
  PLAYING: "PLAYING", // alias for ROOM_SHARED if needed, but keeping it as requested
  RESULT_SUBMITTED: "RESULT_SUBMITTED",
  COMPLETED: "COMPLETED",
  DISPUTED: "DISPUTED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
  SETTLED: "SETTLED",
});

const matchSchema = new mongoose.Schema(
  {
    creator: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    opponent: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    entryCoins: { type: Number, required: true, min: 1 },
    prizeCoins: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: Object.values(MATCH_STATUS),
      default: MATCH_STATUS.WAITING,
    },
    roomCode: { type: String, default: null }, // no longer required/unique initially
    roomCodeSharedAt: { type: Date, default: null },
    winner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    loser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    creatorResult: { type: String, enum: ["WIN", "LOSS", null], default: null },
    opponentResult: { type: String, enum: ["WIN", "LOSS", null], default: null },
    // Screenshots players submit as evidence of the outcome
    resultProof: {
      type: [
        {
          user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
          imageUrl: { type: String, default: "" },
          claimedResult: { type: String, enum: ["WIN", "LOSS"], required: true },
          submittedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    // Automatic API verification data
    ludoRoomResult: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
  },
  { timestamps: true }
);

matchSchema.index({ status: 1, createdAt: -1 });
matchSchema.index({ status: 1, opponent: 1, createdAt: -1 });
matchSchema.index({ creator: 1, opponent: 1, status: 1 });
matchSchema.index({ creator: 1, createdAt: -1 });
matchSchema.index({ opponent: 1, createdAt: -1 });
matchSchema.index({ roomCode: 1, status: 1 }); // Extremely important for Webhook lookups!

export default mongoose.model("Match", matchSchema);
