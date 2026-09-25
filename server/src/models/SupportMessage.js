const mongoose = require("mongoose");

// A message from a user TO the administrators (complaint, question, appeal): the
// intake side of the Admin inbox. Replies from an admin are ordinary messages in
// the user's normal Inbox (Message.adminMessage), so there is no second chat
// system: this collection only holds what users send in.
const supportMessageSchema = new mongoose.Schema(
  {
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: { type: String, enum: ["user", "post", "comment", "reply", "general"], default: "general" },
    subject: { type: String, trim: true, maxlength: 120, default: "" },
    body: { type: String, trim: true, maxlength: 2000, required: true },
    // Optional context, validated on the server when the message is sent.
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: "Report", default: null },
    targetType: { type: String, enum: ["user", "post", "comment", "reply", null], default: null },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    readAt: Date,
    readBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

supportMessageSchema.index({ createdAt: -1 });
supportMessageSchema.index({ readAt: 1, createdAt: -1 });

module.exports = mongoose.model("SupportMessage", supportMessageSchema);
