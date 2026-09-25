const mongoose = require("mongoose");

const REPORT_REASONS = ["spam", "harassment", "inappropriate", "hate", "scam", "other"];
const REPORT_TARGETS = ["user", "post", "comment", "reply"];
const REPORT_STATUSES = ["pending", "reviewing", "resolved", "dismissed"];

// One report about a user, post, comment or reply. Everything about the target
// (who wrote it, which post it lives in) is derived on the SERVER when the report
// is filed, never taken from the client. `snapshot` keeps a short copy of what was
// reported so the report stays understandable after the content is deleted.
const reportSchema = new mongoose.Schema(
  {
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetType: { type: String, enum: REPORT_TARGETS, required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // The person the report is about (the user, or the content's author).
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    // Navigation context: the post a comment/reply lives in, and the top-level
    // comment of that thread (for a reply).
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", default: null },
    threadId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    status: { type: String, enum: REPORT_STATUSES, default: "pending", index: true },
    snapshot: {
      text: { type: String, maxlength: 300, default: "" },
      authorName: { type: String, default: "" },
    },
    resolvedAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // What the admin did: dismissed | content_deleted | user_banned | user_muted | resolved
    resolutionAction: { type: String, default: null },
    resolutionNote: { type: String, maxlength: 500, default: "" },
  },
  { timestamps: true },
);

// A reporter can have only ONE open report per target: a double click or a second
// submission returns the existing report instead of piling up copies.
reportSchema.index(
  { reporterId: 1, targetType: 1, targetId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ["pending", "reviewing"] } } },
);
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ targetType: 1, targetId: 1 });

module.exports = mongoose.model("Report", reportSchema);
module.exports.REPORT_REASONS = REPORT_REASONS;
module.exports.REPORT_TARGETS = REPORT_TARGETS;
module.exports.REPORT_STATUSES = REPORT_STATUSES;
