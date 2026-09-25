const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    body: { type: String, trim: true, maxlength: 1000, required: true },
    // ---- Admin moderation — same states as Post.moderationStatus.
    moderationStatus: { type: String, enum: ["visible", "hidden_by_ban", "deleted"], default: "visible" },
    hiddenReason: { type: String, default: null },
    moderatedAt: Date,
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

commentSchema.index({ authorId: 1, moderationStatus: 1 });
commentSchema.index({ postId: 1, createdAt: 1 });

module.exports = mongoose.model("Comment", commentSchema);
