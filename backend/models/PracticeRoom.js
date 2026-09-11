import mongoose from "mongoose";

const practiceRoomSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // e.g. PRA-849102
    host: { type: String, required: true },
    guest: { type: String, default: null },
    status: { type: String, enum: ["waiting", "active", "completed", "cancelled"], default: "waiting" },
    gameId: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("PracticeRoom", practiceRoomSchema);
