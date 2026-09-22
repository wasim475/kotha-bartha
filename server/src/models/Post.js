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
    media: { publicId: String, secureUrl: String, kind: String },
    deletedAt: Date,
  }, 
  { timestamps: true },
);

module.exports = mongoose.model("Post", postSchema);
