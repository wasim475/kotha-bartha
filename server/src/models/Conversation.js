const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    participantIds: {
      type: [mongoose.Schema.Types.ObjectId],
      required: true,
      index: true,
    },
    // 1-to-1 conversations only — a stable, order-independent key of the
    // two participant ids, used to find-or-create without duplicates.
    // Groups leave this unset; `sparse: true` lets many docs omit it
    // without tripping the unique index.
    pairKey: { type: String, unique: true, sparse: true },
    isGroup: { type: Boolean, default: false },
    groupName: { type: String, trim: true, maxlength: 80 },
    groupAvatar: { publicId: String, secureUrl: String },
    adminIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    hiddenFor: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
      index: true,
    },
    deletedAtBy: {
      type: Map,
      of: Date,
      default: {},
    },
    lastMessage: { type: String, default: "" },
    lastMessageAt: Date,
    unreadCounts: { type: Map, of: Number, default: {} },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Conversation", conversationSchema);
