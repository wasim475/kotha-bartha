const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    participantIds: { type: [mongoose.Schema.Types.ObjectId], required: true, index: true },
    pairKey: { type: String, required: true, unique: true },
    lastMessage: { type: String, default: "" },
    lastMessageAt: Date,
    unreadCounts: { type: Map, of: Number, default: {} },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Conversation", conversationSchema);
