import { useEffect } from "react";
import { api } from "../../../utility/api";
import { sendTypingSignal } from "../../../utility/helpers";

const useMessageActions = ({
  user,
  conversationId,
  selected,
  thread,
  conversations,
  state,
  scrollToBottom,
}) => {
  const {
    body,
    setBody,
    mentionIds,
    setMentionIds,
    replyingTo,
    setReplyingTo,
    setIsTyping,
    setSendError,
    sending,
    setSending,
    setSelectedMessageId,
    setEmojiMessageId,
    localTypingTimeoutRef,
    closeMessageInteractions,
  } = state;

  // Confirmation is handled by the page-level ConfirmDialog before this
  // runs; this just performs the delete + reload.
  const deleteConversation = async (conversationToDelete) => {
    await api.delete(`/conversations/${conversationToDelete}`);
    conversations.reload();
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const text = body.trim();
    if (!text || !conversationId || sending) return;

    clearTimeout(localTypingTimeoutRef.current);
    sendTypingSignal(selected?.user?.id, conversationId, false);
    setIsTyping(false);

    const optimisticId = `pending-${Date.now()}`;
    const optimisticMessage = {
      id: optimisticId,
      body: text,
      createdAt: new Date().toISOString(),
      senderId: user.id,
      status: "sent",
      replyTo: replyingTo,
      reactions: [],
      pending: true,
    };

    setBody("");
    setSendError("");
    setSending(true);
    scrollToBottom();
    thread.setData((messages = []) => [...messages, optimisticMessage]);

    try {
      const { data } = await api.post(
        `/conversations/${conversationId}/messages`,
        { body: text, replyTo: replyingTo?.id || null, mentions: mentionIds },
      );
      const saved = data.data;

      thread.setData((messages = []) =>
        messages.map((message) =>
          message.id === optimisticId
            ? {
                ...saved,
                id: saved.id || saved._id,
                senderId: String(saved.senderId),
                pending: false,
              }
            : message,
        ),
      );

      setReplyingTo(null);
      setMentionIds([]);
      closeMessageInteractions();
      conversations.reload();
    } catch (error) {
      thread.setData((messages = []) =>
        messages.filter((message) => message.id !== optimisticId),
      );
      setBody(text);
      setSendError(
        error.response?.data?.error?.message || "Message could not be sent.",
      );
    } finally {
      setSending(false);
    }
  };

  const sendAttachment = async (file, { durationSec } = {}) => {
    if (!conversationId || !file || sending) return;

    const optimisticId = `pending-${Date.now()}`;
    const localUrl = URL.createObjectURL(file);
    const kind = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("audio/")
        ? "voice"
        : "file";
    const optimisticMessage = {
      id: optimisticId,
      body:
        kind === "image" ? "📷 Photo" : kind === "voice" ? "🎤 Voice message" : `📎 ${file.name}`,
      type: "attachment",
      attachment: {
        url: localUrl,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        kind,
        durationSec,
      },
      createdAt: new Date().toISOString(),
      senderId: user.id,
      status: "sent",
      replyTo: null,
      reactions: [],
      pending: true,
    };

    setSendError("");
    setSending(true);
    scrollToBottom();
    thread.setData((messages = []) => [...messages, optimisticMessage]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (durationSec != null) formData.append("durationSec", String(durationSec));

      const { data } = await api.post(
        `/conversations/${conversationId}/attachments`,
        formData,
        {
          onUploadProgress: (progressEvent) => {
            if (!progressEvent.total) return;
            const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            thread.setData((messages = []) =>
              messages.map((message) =>
                message.id === optimisticId ? { ...message, uploadProgress: percent } : message,
              ),
            );
          },
        },
      );
      const saved = data.data;

      thread.setData((messages = []) =>
        messages.map((message) =>
          message.id === optimisticId
            ? { ...saved, id: saved.id, senderId: String(saved.senderId), pending: false }
            : message,
        ),
      );
      conversations.reload();
    } catch (error) {
      thread.setData((messages = []) =>
        messages.filter((message) => message.id !== optimisticId),
      );
      setSendError(
        error.response?.data?.error?.message || "Attachment could not be sent.",
      );
    } finally {
      URL.revokeObjectURL(localUrl);
      setSending(false);
    }
  };

  const reactToMessage = async (messageId, emoji) => {
    setSelectedMessageId(messageId);
    setEmojiMessageId(null);

    try {
      const { data } = await api.put(
        `/conversations/${conversationId}/messages/${messageId}/reaction`,
        { emoji },
      );
      thread.setData((messages = []) =>
        messages.map((message) =>
          message.id === messageId
            ? { ...message, reactions: data.data.reactions }
            : message,
        ),
      );
    } catch (error) {
      setSendError(
        error.response?.data?.error?.message || "Reaction could not be saved.",
      );
    }
  };

  const selectMessage = (messageId) => {
    setSelectedMessageId((current) => (current === messageId ? null : messageId));
    setEmojiMessageId(null);
  };

  const openEmojiPicker = (messageId) => {
    setSelectedMessageId(messageId);
    setEmojiMessageId((current) => (current === messageId ? null : messageId));
  };

  const replyToMessage = (message) => {
    setReplyingTo(message);
    closeMessageInteractions();
  };

  useEffect(() => {
    const handleOutsideInteraction = (event) => {
      if (
        !event.target.closest("[data-message-row]") &&
        !event.target.closest("[data-emoji-picker]")
      ) {
        closeMessageInteractions();
      }
    };

    document.addEventListener("mousedown", handleOutsideInteraction);
    return () =>
      document.removeEventListener("mousedown", handleOutsideInteraction);
  }, [closeMessageInteractions]);

  return {
    deleteConversation,
    sendMessage,
    sendAttachment,
    reactToMessage,
    selectMessage,
    openEmojiPicker,
    replyToMessage,
  };
};

export default useMessageActions;
