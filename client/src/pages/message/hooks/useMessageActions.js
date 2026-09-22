import { useEffect, useRef } from "react";
import { api } from "../../../utility/api";
import { sendTypingSignal } from "../../../utility/helpers";
import { encryptForDevices, getOrCreateKeyPair } from "../../../utility/crypto";
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

  // Private to the caller — only ever affects how *this* user sees the
  // other participant, never their actual profile name.
  const setNickname = async (targetConversationId, nickname) => {
    const { data } = await api.patch(`/conversations/${targetConversationId}/nickname`, {
      nickname,
    });
    conversations.setData((rows = []) =>
      rows.map((row) =>
        row.id === targetConversationId
          ? { ...row, user: { ...row.user, nickname: data.data.nickname } }
          : row,
      ),
    );
    return data.data.nickname;
  };

  // Shared for every participant — the server broadcasts conversation:theme
  // to the others (see useMessageRealtime), this just applies it locally
  // for the caller's own optimistic update.
  const setConversationTheme = async (targetConversationId, theme) => {
    const { data } = await api.patch(`/conversations/${targetConversationId}/theme`, { theme });
    conversations.setData((rows = []) =>
      rows.map((row) => (row.id === targetConversationId ? { ...row, theme: data.data.theme } : row)),
    );
    return data.data.theme;
  };

  // Reuses the app's single global block system (POST/DELETE /blocks/:userId
  // — the same endpoints Profile's Block button calls) rather than a
  // separate conversation-scoped block, so blocking here has the exact same
  // effect (and is visible/reversible) everywhere else blocking matters.
  const toggleBlockUser = async (otherUserId, currentlyBlocked) => {
    if (currentlyBlocked) await api.delete(`/blocks/${otherUserId}`);
    else await api.post(`/blocks/${otherUserId}`);
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
      // has published at least one device's public key. Encrypted once per
      // known device on both sides — the peer's, so any of their open
      // browsers can read it, and this account's own other devices, so a
      // refresh or a second browser for the *same* account can too. Falls
      // back to plaintext otherwise — nothing about sending breaks if
      // encryption isn't available.
      const targets = !selected?.isGroup
        ? [...(selected?.user?.publicKeys || []), ...(user?.publicKeys || [])]
        : [];
      const encrypted = targets.length
        ? await encryptForDevices(conversationId, targets, text, user.id)
        : null;

      const requestBody = encrypted
        ? {
            encrypted: true,
            senderPublicKey: encrypted.senderPublicKey,
            encryptedPayloads: encrypted.payloads,
          }
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

  // Guards against a second reaction request firing for the same message
  // while one is already in flight (e.g. a fast double click/tap) —
  // callers (the quick reaction bar and the full emoji picker) already
  // close the popup themselves before calling this, so it doesn't need to
  // touch selection/emoji-picker state at all here.
  const reactingMessageIds = useRef(new Set());

  const reactToMessage = async (messageId, emoji) => {
    if (reactingMessageIds.current.has(messageId)) return;
    reactingMessageIds.current.add(messageId);

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
    } finally {
      reactingMessageIds.current.delete(messageId);
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
    const targets =
      target && !target.isGroup
        ? [...(target.user?.publicKeys || []), ...(user?.publicKeys || [])]
        : [];
    const encrypted = targets.length
      ? await encryptForDevices(targetConversationId, targets, text, user.id)
      : null;

    const requestBody = encrypted
      ? {
          encrypted: true,
          senderPublicKey: encrypted.senderPublicKey,
          encryptedPayloads: encrypted.payloads,
        }
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
    setNickname,
    setConversationTheme,
    toggleBlockUser,
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
