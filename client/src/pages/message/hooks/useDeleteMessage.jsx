import { useState } from "react";
import { api } from "../../../utility/api";

const useDeleteMessage = ({
  conversationId,
  thread,
  conversations,
  preserveScrollPosition,
}) => {
  const [deletingMessage, setDeletingMessage] = useState(null);

  const removeLocally = (messageId) => {
    preserveScrollPosition();
    thread.setData((messages = []) =>
      messages.filter((message) => message.id !== messageId),
    );
  };

  // Removes the message for every participant (sender-only, time-limited —
  // the server is the source of truth on the window, this just surfaces
  // whatever it decides).
  const deleteForEveryone = async (messageId) => {
    if (deletingMessage) return null;
    setDeletingMessage(messageId);

    try {
      await api.delete(`/conversations/${conversationId}/messages/${messageId}`);
      removeLocally(messageId);
      conversations.reload();
      return null;
    } catch (error) {
      return (
        error.response?.data?.error?.message || "Message could not be deleted."
      );
    } finally {
      setDeletingMessage(null);
    }
  };

  // Hides the message for the current user only — no time limit, works on
  // any message (own or not). Nothing is broadcast to other participants.
  const deleteForMe = async (messageId) => {
    if (deletingMessage) return null;
    setDeletingMessage(messageId);

    try {
      await api.post(
        `/conversations/${conversationId}/messages/${messageId}/delete-for-me`,
      );
      removeLocally(messageId);
      return null;
    } catch (error) {
      return (
        error.response?.data?.error?.message || "Message could not be removed."
      );
    } finally {
      setDeletingMessage(null);
    }
  };

  return {
    deletingMessage,
    deleteForEveryone,
    deleteForMe,
  };
};

export default useDeleteMessage;
