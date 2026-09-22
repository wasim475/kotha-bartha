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
    // Null for group messages — a group has many recipients, delivered by
    // iterating the conversation's participantIds instead of one field.
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    body: {
      type: String,
      trim: true,
      maxlength: 5000,
      required: true,
    },
    type: {
      type: String,
      enum: ["text", "call", "attachment"],
      default: "text",
    },
    call: {
      outcome: { type: String, enum: ["completed", "missed", "cancelled"] },
      durationSec: { type: Number, default: 0 },
    },
    attachment: {
      url: String,
      publicId: String,
      fileName: String,
      mimeType: String,
      size: Number,
      kind: { type: String, enum: ["image", "voice", "file"] },
      durationSec: Number,
    },
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    reactions: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        emoji: { type: String, required: true, maxlength: 8 },
      },
    ],
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    editedAt: Date,
    deletedAt: Date,
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
