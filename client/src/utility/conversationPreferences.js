const mutedConversationsKey = (userId) =>
  `kotha-bartha:muted-conversations:${userId}`;

const readMutedConversations = (userId) => {
  try {
    const stored = JSON.parse(
      localStorage.getItem(mutedConversationsKey(userId)) || "[]",
    );
    return new Set(Array.isArray(stored) ? stored.map(String) : []);
  } catch {
    return new Set();
  }
};

export const isConversationMuted = (userId, conversationId) =>
  readMutedConversations(userId).has(String(conversationId));

export const setConversationMuted = (userId, conversationId, muted) => {
  const mutedConversations = readMutedConversations(userId);
  const normalizedId = String(conversationId);

  if (muted) {
    mutedConversations.add(normalizedId);
  } else {
    mutedConversations.delete(normalizedId);
  }

  localStorage.setItem(
    mutedConversationsKey(userId),
    JSON.stringify([...mutedConversations]),
  );
};
