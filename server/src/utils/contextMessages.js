const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const { pairKey } = require("./ids");
const { emitToUser } = require("./realtime");
const { UNSEND_WINDOW_MS } = require("./config");

// Same small helpers chat.routes.js keeps local to itself, duplicated here
// since story/note reactions originate from the Feed/Story viewer, not the
// Messages page, and don't share a router with chat.routes.js to import
// them from.
const otherParticipants = (conversation, excludeUserId) =>
  conversation.participantIds.filter((id) => id.toString() !== excludeUserId.toString());

const clearHiddenFor = (conversation, ids) => {
  const idStrings = new Set(ids.map((id) => id.toString()));
  conversation.hiddenFor = (conversation.hiddenFor || []).filter(
    (id) => !idStrings.has(id.toString()),
  );
};

const bumpUnreadFor = (conversation, ids) => {
  ids.forEach((id) => {
    const key = id.toString();
    conversation.unreadCounts?.set(key, (conversation.unreadCounts?.get(key) || 0) + 1);
  });
};

// Finds-or-creates the 1:1 conversation between two users — the same
// findOneAndUpdate-by-pairKey upsert chat.routes.js's own POST
// /conversations uses.
async function findOrCreateDirectConversation(userIdA, userIdB) {
  const key = pairKey(userIdA, userIdB);
  return Conversation.findOneAndUpdate(
    { pairKey: key },
    { $setOnInsert: { participantIds: [userIdA, userIdB], pairKey: key } },
    { new: true, upsert: true },
  );
}

// Sends a plaintext message carrying `storyContext` — the compact,
// visually-secondary "replying to a Story/Note" card MessageBubble.jsx
// renders. Deliberately never E2E-encrypted: these originate outside the
// Messages page's key-exchange pipeline (client/src/utility/crypto.js), so
// they're sent the same way an attachment message already is — plaintext,
// which is safe to mix into an otherwise-encrypted 1:1 thread since
// encryption here is already opportunistic per-message, not
// per-conversation (see Message.js's own `encrypted` field comment).
// Shared by both the freshly-created and the deduped-existing-reaction
// paths below, so a repeated-click response looks identical in shape to a
// brand new one — built from the persisted `message` document itself
// (not the caller's input), so it's correct either way.
function buildPayload(req, message, conversationId) {
  const context = message.storyContext;
  return {
    id: message._id.toString(),
    conversationId: conversationId.toString(),
    encrypted: false,
    encryptedBody: null,
    encryptedPayloads: null,
    senderPublicKey: null,
    body: message.body,
    type: "text",
    call: null,
    attachment: null,
    mentions: [],
    storyContext: {
      refType: context.refType,
      refId: context.refId.toString(),
      action: context.action,
      reactionEmoji: context.reactionEmoji || null,
      authorId: context.authorId.toString(),
      expiresAt: context.expiresAt,
      snapshot: context.snapshot,
    },
    createdAt: message.createdAt,
    senderId: message.senderId.toString(),
    sender: {
      id: req.user._id.toString(),
      fullName: req.user.fullName,
      avatar: req.user.avatar,
    },
    status: message.status,
    unsendExpiresAt: new Date(new Date(message.createdAt).getTime() + UNSEND_WINDOW_MS),
    forwardedFrom: null,
    replyTo: null,
    reactions: [],
  };
}

async function sendContextMessage(req, { owner, body, storyContext }) {
  const conversation = await findOrCreateDirectConversation(req.user._id, owner._id);
  const others = otherParticipants(conversation, req.user._id);

  // Reacting again with the same emoji is a no-op, not a second message —
  // guards against accidental repeated clicks spamming duplicate DMs.
  if (storyContext.action === "reaction") {
    const existing = await Message.findOne({
      conversationId: conversation._id,
      senderId: req.user._id,
      "storyContext.refId": storyContext.refId,
      "storyContext.action": "reaction",
      "storyContext.reactionEmoji": storyContext.reactionEmoji,
    });
    if (existing) {
      return {
        message: existing,
        conversation,
        payload: buildPayload(req, existing, conversation._id),
        deduped: true,
      };
    }
  }

  clearHiddenFor(conversation, [req.user._id, ...others]);

  const message = await Message.create({
    conversationId: conversation._id,
    senderId: req.user._id,
    recipientId: conversation.isGroup ? null : others[0],
    body,
    status: "delivered",
    storyContext,
  });

  conversation.lastMessage = body;
  conversation.lastMessageAt = message.createdAt;
  bumpUnreadFor(conversation, others);
  await conversation.save();

  const payload = buildPayload(req, message, conversation._id);

  others.forEach((id) => emitToUser(req, id, "message:new", payload));

  return { message, conversation, payload, deduped: false };
}

module.exports = { findOrCreateDirectConversation, sendContextMessage };
