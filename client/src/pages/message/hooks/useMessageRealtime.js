import { useRealtime } from "../../../utility/helpers";
import { playReactionSound } from "../../../utility/sound";

const useMessageRealtime = ({
  conversationId,
  selected,
  conversations,
  thread,
  groupDetail,
  setIsTyping,
  remoteTypingTimeoutRef,
  prepareForIncomingMessage,
}) => {
  useRealtime("message:new", (event) => {
    conversations.reload();
    if (event.detail.conversationId === conversationId) {
      prepareForIncomingMessage();
      thread.reload();
    }
  });

  useRealtime("message:updated", (event) => {
    if (event.detail.conversationId !== conversationId) return;
    prepareForIncomingMessage();
    thread.setData((messages = []) =>
      messages.map((message) =>
        message.id === event.detail.id
          ? {
              ...message,
              body: event.detail.body,
              encrypted: event.detail.encrypted,
              encryptedBody: event.detail.encryptedBody,
              encryptedPayloads: event.detail.encryptedPayloads,
              senderPublicKey: event.detail.senderPublicKey,
              // Reset so useE2EDecryption re-decrypts the new ciphertext.
              _decryptState: event.detail.encrypted ? undefined : "ok",
              editedAt: event.detail.editedAt,
            }
          : message,
      ),
    );
    conversations.reload();
  });

  useRealtime("message:deleted", (event) => {
    if (event.detail.conversationId !== conversationId) return;
    prepareForIncomingMessage();
    thread.setData((messages = []) =>
      messages.filter((message) => message.id !== event.detail.id),
    );
    conversations.reload();
  });

  useRealtime("message:reaction", (event) => {
    if (event.detail.conversationId !== conversationId) return;
    thread.setData((messages = []) =>
      messages.map((message) =>
        message.id === event.detail.id
          ? { ...message, reactions: event.detail.reactions }
          : message,
      ),
    );
    // The server never broadcasts this back to whoever triggered it (see
    // chat.routes.js's reaction route), so any client receiving it here is
    // always someone other than the actor — safe to play without risking a
    // double-sound for the person who reacted (they already heard it
    // immediately from useMessageActions' own reactToMessage call).
    playReactionSound();
  });

  useRealtime("message:read", (event) => {
    if (event.detail.conversationId !== conversationId) return;
    thread.setData((messages = []) =>
      messages.map((message) =>
        message.id === event.detail.id
          ? { ...message, status: "read" }
          : message,
      ),
    );
  });

  useRealtime("typing:start", (event) => {
    if (
      event.detail.conversationId !== conversationId ||
      event.detail.senderId !== String(selected?.user?.id)
    )
      return;

    setIsTyping(true);
    clearTimeout(remoteTypingTimeoutRef.current);
    remoteTypingTimeoutRef.current = setTimeout(() => setIsTyping(false), 2500);
  });

  useRealtime("typing:stop", (event) => {
    if (
      event.detail.conversationId === conversationId &&
      event.detail.senderId === String(selected?.user?.id)
    ) {
      clearTimeout(remoteTypingTimeoutRef.current);
      setIsTyping(false);
    }
  });

  useRealtime("presence:update", (event) => {
    const { userId, isOnline, lastSeenAt } = event.detail;
    conversations.setData((rows = []) =>
      rows.map((row) =>
        row.user?.id === userId
          ? {
              ...row,
              user: {
                ...row.user,
                isOnline,
                lastSeenAt: lastSeenAt || row.user.lastSeenAt,
              },
            }
          : row,
      ),
    );
  });

  // Group renamed/avatar changed/members added or removed.
  useRealtime("conversation:updated", (event) => {
    const { id, ...group } = event.detail;
    conversations.setData((rows = []) =>
      rows.map((row) => (row.id === id ? { ...row, group: { ...row.group, ...group } } : row)),
    );
    if (id === conversationId) groupDetail?.reload();
  });

  // The other participant changed this conversation's shared theme — keep
  // it in sync without a full reload (nicknames are private per-setter and
  // never broadcast, unlike this).
  useRealtime("conversation:theme", (event) => {
    const { id, theme } = event.detail;
    conversations.setData((rows = []) =>
      rows.map((row) => (row.id === id ? { ...row, theme } : row)),
    );
  });

  useRealtime("realtime:connected", () => {
    conversations.reload();
    if (conversationId) {
      prepareForIncomingMessage();
      thread.reload();
    }
  });
};

export default useMessageRealtime;
