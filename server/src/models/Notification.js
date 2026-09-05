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
    uniqueEventId: { type: String, required: true, unique: true },
    readAt: Date,
    payload: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Notification", notificationSchema);
