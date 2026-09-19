import { useRealtime } from "../../../utility/helpers";

const useMessageRealtime = ({
  conversationId,
  selected,
  conversations,
  thread,
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

  useRealtime("realtime:connected", () => {
    conversations.reload();
    if (conversationId) {
      prepareForIncomingMessage();
      thread.reload();
    }
  });
};

export default useMessageRealtime;
