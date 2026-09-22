import { useEffect } from "react";
import { api } from "../../../utility/api";
import { sendTypingSignal } from "../../../utility/helpers";
import { deriveSharedKey, encryptMessage, getOrCreateKeyPair } from "../../../utility/crypto";
import { playReactionSound } from "../../../utility/sound";

const useMessageActions = ({
  user,
  conversationId,
  selected,
  thread,
  conversations,
  archived,
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

  // Publishes this device's E2E public key (once) so peers can start
  // encrypting to us — safe to call unconditionally, it's a no-op after
  // the first successful publish.
  useEffect(() => {
    if (user?.id) getOrCreateKeyPair(user.id);
  }, [user?.id]);

  // Confirmation is handled by the page-level ConfirmDialog before this
  // runs; this just performs the delete + reload.
  const deleteConversation = async (conversationToDelete) => {
    await api.delete(`/conversations/${conversationToDelete}`);
    conversations.reload();
    archived?.reload();
  };

  const archiveConversation = async (conversationToArchive) => {
    await api.post(`/conversations/${conversationToArchive}/archive`);
    conversations.reload();
    archived?.reload();
  };

  const unarchiveConversation = async (conversationToUnarchive) => {
    await api.post(`/conversations/${conversationToUnarchive}/unarchive`);
    conversations.reload();
    archived?.reload();
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
      // Opportunistic E2E: only for 1-to-1 conversations where the peer
      // has published a public key. Falls back to plaintext otherwise —
      // nothing about sending breaks if encryption isn't available.
      const peerPublicKey = !selected?.isGroup ? selected?.user?.publicKey : null;
      const sharedKey = peerPublicKey
        ? await deriveSharedKey(conversationId, peerPublicKey, user.id)
        : null;

      const requestBody = sharedKey
        ? { encrypted: true, ...(await encryptMessage(sharedKey, text)) }
        : { body: text };

      const { data } = await api.post(`/conversations/${conversationId}/messages`, {
        ...requestBody,
        replyTo: replyingTo?.id || null,
        mentions: mentionIds,
      });
      const saved = data.data;

      thread.setData((messages = []) =>
        messages.map((message) =>
          message.id === optimisticId
            ? {
                ...saved,
                id: saved.id || saved._id,
                senderId: String(saved.senderId),
                // We already have the plaintext locally — no need to
                // round-trip through decryption for our own sent message
                // (or its reply quote, if it's a reply to an encrypted one).
                body: text,
                _decryptState: saved.encrypted ? "ok" : undefined,
                replyTo:
                  replyingTo && saved.replyTo
                    ? {
                        ...saved.replyTo,
                        body: replyingTo.body,
                        _decryptState: replyingTo._decryptState,
                      }
                    : saved.replyTo,
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
      playReactionSound();
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

  const togglePin = async (messageId, currentlyPinned) => {
    try {
      if (currentlyPinned) {
        await api.delete(`/conversations/${conversationId}/messages/${messageId}/pin`);
      } else {
        await api.post(`/conversations/${conversationId}/messages/${messageId}/pin`);
      }
    } catch (error) {
      setSendError(error.response?.data?.error?.message || "Couldn't update the pin.");
    }
  };

  const forwardMessage = async (messageId, targetConversationIds) => {
    const { data } = await api.post(
      `/conversations/${conversationId}/messages/${messageId}/forward`,
      { targetConversationIds },
    );
    conversations.reload();
    archived?.reload();
    return data.data;
  };

  // Encrypted messages can't be forwarded server-side (the server never
  // sees their plaintext to copy) — the client already holds the decrypted
  // text for rendering, so this re-encrypts it under each target
  // conversation's own key (or sends plaintext into a group) via a normal
  // send, one target at a time.
  const forwardPlaintext = async (targetConversationId, text) => {
    const target = conversations.data?.find((c) => c.id === targetConversationId);
    const peerPublicKey = target && !target.isGroup ? target.user?.publicKey : null;
    const sharedKey = peerPublicKey
      ? await deriveSharedKey(targetConversationId, peerPublicKey, user.id)
      : null;

    const requestBody = sharedKey
      ? { encrypted: true, ...(await encryptMessage(sharedKey, text)) }
      : { body: text };

    await api.post(`/conversations/${targetConversationId}/messages`, requestBody);
    conversations.reload();
    archived?.reload();
  };

  useEffect(() => {
    const handleOutsideInteraction = (event) => {
      if (
        !event.target.closest("[data-message-row]") &&
        !event.target.closest("[data-emoji-picker]") &&
        !event.target.closest("[data-message-actions]")
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
    archiveConversation,
    unarchiveConversation,
    sendMessage,
    sendAttachment,
    reactToMessage,
    selectMessage,
    openEmojiPicker,
    replyToMessage,
    togglePin,
    forwardMessage,
    forwardPlaintext,
  };
};

export default useMessageActions;
