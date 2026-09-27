// Shared by chat.routes.js and call.service.js — a 1-to-1 conversation is
// just a group of two without a name, so these work the same for both.

const otherParticipants = (conversation, excludeUserId) =>
  conversation.participantIds.filter((id) => id.toString() !== excludeUserId.toString());

const clearHiddenFor = (conversation, ids) => {
  const idStrings = new Set([...ids].map((id) => id.toString()));
  conversation.hiddenFor = (conversation.hiddenFor || []).filter((id) => !idStrings.has(id.toString()));
};

const bumpUnreadFor = (conversation, ids) => {
  ids.forEach((id) => {
    const key = id.toString();
    conversation.unreadCounts?.set(key, (conversation.unreadCounts?.get(key) || 0) + 1);
  });
};

module.exports = { otherParticipants, clearHiddenFor, bumpUnreadFor };
