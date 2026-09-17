import { useState } from "react";
import { api } from "../../../utility/api";

const useEditMessage = ({
  conversationId,
  thread,
  conversations,
  preserveScrollPosition,
}) => {
  const [editingMessage, setEditingMessage] = useState(null);
  const [editBody, setEditBody] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const handleEdit = (message) => {
    setEditingMessage(message.id);
    setEditBody(message.body || "");
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setEditBody("");
  };

  const saveEdit = async (messageId) => {
    const text = editBody.trim();

    if (!text || editLoading) {
      return;
    }

    setEditLoading(true);

    try {
      const { data } = await api.patch(
        `/conversations/${conversationId}/messages/${messageId}`,
        {
          body: text,
        },
      );

      const updated = data.data;

      preserveScrollPosition();

      thread.setData((messages = []) =>
        messages.map((message) =>
          message.id === messageId
            ? {
                ...message,
                ...updated,
                id:
                  updated.id ||
                  updated._id ||
                  message.id,
                body: updated.body,
                editedAt:
                  updated.editedAt ||
                  new Date().toISOString(),
              }
            : message,
        ),
      );

      setEditingMessage(null);
      setEditBody("");

      conversations.reload();

      return null;
    } catch (error) {
      return (
        error.response?.data?.error?.message ||
        "Message could not be edited."
      );
    } finally {
      setEditLoading(false);
    }
  };

  return {
    editingMessage,
    editBody,
    editLoading,
    setEditBody,
    handleEdit,
    cancelEdit,
    saveEdit,
  };
};

export default useEditMessage;