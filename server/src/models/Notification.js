const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    type: { type: String, required: true },
    entityType: String,
    entityId: mongoose.Schema.Types.ObjectId,
    // Structured deep-link target, set alongside the legacy entityType/
    // entityId pair above. postId is always the post; commentId is always
    // the top-level thread root (even for a reply's notification); replyId
    // is set only when the notification is specifically about a reply.
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", index: true },
    commentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", index: true },
    replyId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", index: true },
    uniqueEventId: { type: String, required: true, unique: true },
    readAt: Date,
    payload: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Notification", notificationSchema);
