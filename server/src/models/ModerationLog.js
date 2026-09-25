const mongoose = require("mongoose");

// The Admin Panel's audit trail. Append-only: the app only ever creates entries
// (services/adminAudit.service.js). Update and delete operations on this model
// are refused at the schema level, so no route or script can rewrite history by
// accident. Never store credentials or message bodies in `metadata`.
const moderationLogSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    adminRole: { type: String, default: "admin" },
    action: { type: String, required: true, index: true },
    targetType: { type: String, default: null },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

moderationLogSchema.index({ createdAt: -1 });

const refuse = () => {
  throw new Error("Moderation logs are append-only.");
};
[
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "findOneAndReplace",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
].forEach((operation) => moderationLogSchema.pre(operation, refuse));
moderationLogSchema.pre("save", function refuseChange() {
  if (!this.isNew) refuse();
});

module.exports = mongoose.model("ModerationLog", moderationLogSchema);
