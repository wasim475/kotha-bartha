const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Not `required` — a post may be image-only (see routes/posts.routes.js,
    // which still requires at least one of body/image at creation time).
    body: { type: String, trim: true, maxlength: 5000, default: "" },
    // `kind`, not `type` — Mongoose reserves a "type" key inside a nested
    // path definition to mean the path's OWN schema type (e.g. String),
    // not an arbitrary sub-field. A field literally named `type` here
    // silently collapses this whole object into a plain String path,
    // discarding publicId/secureUrl entirely instead of being a
    // {publicId, secureUrl, kind} sub-document — see Message.attachment.kind
    // for the same convention already used to avoid this elsewhere.
    media: {
      type: [{ publicId: String, secureUrl: String, kind: String }],
      default: [],
    },
    deletedAt: Date,
    // ---- Admin moderation. "visible" (also: field absent) | "hidden_by_ban"
    // (the author was banned; restored on unban, and ONLY this reason is ever
    // restored) | "deleted" (removed by an admin; never restored).
    moderationStatus: { type: String, enum: ["visible", "hidden_by_ban", "deleted"], default: "visible" },
    hiddenReason: { type: String, default: null },
    moderatedAt: Date,
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

postSchema.index({ authorId: 1, moderationStatus: 1 });
postSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Post", postSchema);
