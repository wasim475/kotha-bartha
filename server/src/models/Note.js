const mongoose = require("mongoose");

// Same 24h lifetime as Story.STORY_EXPIRY_MS (see Story.js) — Notes use
// the same "expires automatically after 24 hours" design.
const NOTE_EXPIRY_MS = 24 * 60 * 60 * 1000;

const noteSchema = new mongoose.Schema(
  {
    // One active note per user — a unique index rather than allowing many,
    // matching the short-lived "what's on your mind right now" concept
    // (posting a new note simply overwrites/refreshes the old one, done via
    // findOneAndUpdate upsert in notes.routes.js).
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    text: { type: String, trim: true, maxlength: 150, required: true },
    // Same MongoDB TTL-index approach as Story.expiresAt — see that
    // model's comment for why routes also defensively filter
    // `expiresAt: { $gt: now }` themselves.
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + NOTE_EXPIRY_MS),
      index: { expires: 0 },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Note", noteSchema);
module.exports.NOTE_EXPIRY_MS = NOTE_EXPIRY_MS;
