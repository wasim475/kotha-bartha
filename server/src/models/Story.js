const mongoose = require("mongoose");

const STORY_EXPIRY_MS = 24 * 60 * 60 * 1000;

const storySchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: { type: String, enum: ["text", "image"], required: true },
    // Text stories: the story's own text, shown on `backgroundColor` in
    // `textColor`. Image stories: an optional short overlay caption over
    // the image, in `textColor` — `backgroundColor` is unused.
    text: { type: String, trim: true, maxlength: 500, default: "" },
    textColor: { type: String, trim: true, maxlength: 20, default: "#ffffff" },
    backgroundColor: { type: String, trim: true, maxlength: 20, default: "#e96449" },
    media: { publicId: String, secureUrl: String },
    // MongoDB's TTL monitor removes the document on its own once this is
    // in the past (checked roughly every 60s) — no cron job needed for
    // "expires automatically after 24 hours". Routes also defensively
    // filter `expiresAt: { $gt: now }` themselves, since TTL cleanup isn't
    // instantaneous, so an expired story is never served in that gap.
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + STORY_EXPIRY_MS),
      index: { expires: 0 },
    },
  },
  { timestamps: true },
);

storySchema.index({ authorId: 1, expiresAt: 1 });

module.exports = mongoose.model("Story", storySchema);
module.exports.STORY_EXPIRY_MS = STORY_EXPIRY_MS;
