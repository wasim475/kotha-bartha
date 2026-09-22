const mongoose = require("mongoose");
const { THEME_IDS } = require("../utils/conversationThemes");

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
    // Per-user last-read timestamp, used to compute the "first unread"
    // message for the jump-to-unread affordance. Parallel to unreadCounts.
    lastReadAt: { type: Map, of: Date, default: {} },
    // Per-user archive flag — archiving only ever affects the archiving
    // user's own conversation list, never the other participant(s).
    archivedFor: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
      index: true,
    },
    // Group chats only (enforced in chat.routes.js) — any member may pin.
    pinnedMessages: [
      {
        messageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
        pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        pinnedAt: { type: Date, default: Date.now },
      },
    ],
    // 1-to-1 conversations only (enforced in chat.routes.js) — a private,
    // per-setter label for the *other* participant. Keyed by the user who
    // set it, so each side can keep their own nickname for the other person
    // without either seeing the other's choice or touching their real
    // profile name.
    nicknames: { type: Map, of: String, default: {} },
    // A shared "chat theme" accent, synced for every participant (unlike
    // nicknames, this is one value for the whole conversation, not per-user)
    // — see client/src/pages/message/utility/conversationThemes.js for the
    // actual color values.
    theme: { type: String, enum: THEME_IDS, default: "default" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Conversation", conversationSchema);
