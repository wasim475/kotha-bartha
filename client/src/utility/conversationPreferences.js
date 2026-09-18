const mutedConversationsKey = "kotha-bartha:muted-conversations";

const readMutedConversations = () => {
  try {
    const stored = JSON.parse(
      localStorage.getItem(mutedConversationsKey) || "[]",
    );
    return new Set(Array.isArray(stored) ? stored.map(String) : []);
  } catch {
    return new Set();
  }
};

export const isConversationMuted = (conversationId) =>
  readMutedConversations().has(String(conversationId));

export const setConversationMuted = (conversationId, muted) => {
  const mutedConversations = readMutedConversations();
  const normalizedId = String(conversationId);

  if (muted) {
    mutedConversations.add(normalizedId);
  } else {
    mutedConversations.delete(normalizedId);
  }

  localStorage.setItem(
    mutedConversationsKey,
    JSON.stringify([...mutedConversations]),
  );
};
