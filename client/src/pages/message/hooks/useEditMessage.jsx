import { useState } from "react";
import { api } from "../../../utility/api";
import { deriveSharedKey, encryptMessage } from "../../../utility/crypto";

const useEditMessage = ({
  conversationId,
  thread,
  conversations,
  selected,
  userId,
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
      const original = (thread.data || []).find((message) => message.id === messageId);
      const peerPublicKey = !selected?.isGroup ? selected?.user?.publicKey : null;
      const sharedKey =
        original?.encrypted && peerPublicKey
          ? await deriveSharedKey(conversationId, peerPublicKey, userId)
          : null;

      const requestBody = sharedKey
        ? { encrypted: true, ...(await encryptMessage(sharedKey, text)) }
        : { body: text };

      const { data } = await api.patch(
        `/conversations/${conversationId}/messages/${messageId}`,
        requestBody,
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
                // We already have the plaintext locally.
                body: text,
                _decryptState: updated.encrypted ? "ok" : undefined,
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