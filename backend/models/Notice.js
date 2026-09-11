import mongoose from "mongoose";

const noticeSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    dateTag: { type: String, default: "" }, // e.g. "30 Aug 2026"
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Notice", noticeSchema);
