import { useState } from "react";
import { api } from "../../../utility/api";

const useDeleteMessage = ({
  conversationId,
  thread,
  conversations,
  preserveScrollPosition,
}) => {
  const [deletingMessage, setDeletingMessage] =
    useState(null);

  const handleDelete = async (messageId) => {
    if (deletingMessage) {
      return null;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this message?",
    );

    if (!confirmed) {
      return null;
    }

    setDeletingMessage(messageId);

    try {
      await api.delete(
        `/conversations/${conversationId}/messages/${messageId}`,
      );

      preserveScrollPosition();

      thread.setData((messages = []) =>
        messages.filter(
          (message) => message.id !== messageId,
        ),
      );

      conversations.reload();

      return null;
    } catch (error) {
      return (
        error.response?.data?.error?.message ||
        "Message could not be deleted."
      );
    } finally {
      setDeletingMessage(null);
    }
  };

  return {
    deletingMessage,
    handleDelete,
  };
};

export default useDeleteMessage;