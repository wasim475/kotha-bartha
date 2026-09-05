const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    body: { type: String, trim: true, maxlength: 5000, required: true },
    status: {
      type: String,
      enum: ["sending", "delivered", "seen"],
      default: "sending",
    },
    editedAt: Date,
    deletedAt: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Message", messageSchema);
