import { useEffect } from "react";
import Swal from "sweetalert2";
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
    replyingTo,
    setReplyingTo,
    setIsTyping,
    setSendError,
    sending,
    setSending,
    setSelectedMessageId,
    setEmojiMessageId,
    setOpenMenu,
    localTypingTimeoutRef,
    closeMessageInteractions,
  } = state;

  const deleteConversation = async (conversationToDelete) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    });

    if (!result.isConfirmed) return;

    await api.delete(`/conversations/${conversationToDelete}`);
    conversations.reload();
    Swal.fire({
      title: "Deleted!",
      text: "Your file has been deleted.",
      icon: "success",
    });
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
        { body: text, replyTo: replyingTo?.id || null },
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

  const toggleMessageMenu = (messageId) => {
    setOpenMenu((current) => (current === messageId ? null : messageId));
  };

  const selectMessage = (messageId) => {
    setSelectedMessageId(messageId);
    setEmojiMessageId(null);
    setOpenMenu(null);
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
        !event.target.closest(".message-interaction") &&
        !event.target.closest(".message-bubble") &&
        !event.target.closest(".message-menu")
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
    reactToMessage,
    toggleMessageMenu,
    selectMessage,
    openEmojiPicker,
    replyToMessage,
  };
};

export default useMessageActions;
