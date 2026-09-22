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
    // Global "deleted for everyone" marker (sender-only, time-limited).
    deletedAt: Date,
    // Per-user "deleted for me" list — hides the message for these users
    // only; everyone else still sees it normally.
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    forwardedFrom: {
      originalMessageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
      originalSenderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    // E2E encryption (1-to-1 text messages only — see server/src/routes
    // chat.routes.js). When `encrypted` is true, `body` is a placeholder,
    // never the plaintext; the real content lives only in the fields below
    // and can only be read by clients holding a matching private key.
    encrypted: { type: Boolean, default: false },
    // Legacy single-shared-key format — one ciphertext for the entire
    // conversation, decryptable only by whichever exact keypair pair
    // produced it. No longer written by current clients; kept so
    // pre-multi-device messages stay readable exactly as before.
    encryptedBody: {
      ciphertext: String,
      iv: String,
    },
    // Current multi-device format — one ciphertext per target device (the
    // recipient's devices plus the sender's own other devices), each
    // decryptable by that one device's private key together with
    // `senderPublicKey` below (the exact key the sending device used).
    encryptedPayloads: [
      {
        _id: false,
        deviceId: String,
        ciphertext: String,
        iv: String,
      },
    ],
    senderPublicKey: String,
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
