import mongoose from "mongoose";

const UserContactSchema = new mongoose.Schema(
  {
    fetchedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Prevent the same user from uploading the same contact multiple times
UserContactSchema.index({ fetchedBy: 1, phone: 1 }, { unique: true });

export default mongoose.model("UserContact", UserContactSchema);
