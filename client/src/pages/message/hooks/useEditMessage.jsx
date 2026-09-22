import { useState } from "react";
import { api } from "../../../utility/api";
import { encryptForDevices } from "../../../utility/crypto";

const useEditMessage = ({
  conversationId,
  thread,
  conversations,
  selected,
  userId,
  myPublicKeys,
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
      const targets =
        original?.encrypted && !selected?.isGroup
          ? [...(selected?.user?.publicKeys || []), ...(myPublicKeys || [])]
          : [];
      const encrypted = targets.length
        ? await encryptForDevices(conversationId, targets, text, userId)
        : null;

      const requestBody = encrypted
        ? {
            encrypted: true,
            senderPublicKey: encrypted.senderPublicKey,
            encryptedPayloads: encrypted.payloads,
          }
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