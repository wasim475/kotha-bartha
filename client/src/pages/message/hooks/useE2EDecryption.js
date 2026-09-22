import { useEffect } from "react";
import { decryptMessage, deriveSharedKey } from "../../../utility/crypto";

const needsDecryption = (content) => content?.encrypted && content._decryptState == null;

// Decrypts any encrypted messages (and encrypted reply-quote previews) in
// the active thread as they arrive — initial load, realtime message:new
// (which reloads the thread), and reconnect. Server never sees the
// plaintext, so this is the only place it exists on the receiving side.
const useE2EDecryption = ({ conversationId, selected, userId, thread }) => {
  useEffect(() => {
    if (!conversationId || selected?.isGroup) return undefined;
    const peerPublicKey = selected?.user?.publicKey;

    const pendingMessages = (thread.data || []).filter(
      (message) => needsDecryption(message) || needsDecryption(message.replyTo),
    );
    if (!pendingMessages.length) return undefined;

    // The peer's public key hasn't loaded yet (e.g. the conversation list
    // fetch that carries it hasn't resolved) — this is transient, not a
    // real failure, so leave these messages untouched rather than marking
    // them permanently "failed". The effect re-runs and retries as soon as
    // `selected.user.publicKey` actually has a value (see the dependency
    // array below) instead of getting stuck forever on a one-time miss.
    if (!peerPublicKey) return undefined;

    let cancelled = false;

    (async () => {
      const sharedKey = await deriveSharedKey(conversationId, peerPublicKey, userId);
      if (cancelled) return;

      const decryptOne = async (content) => {
        if (!sharedKey) return { body: "🔒 Unable to decrypt", _decryptState: "failed" };
        try {
          const plaintext = await decryptMessage(sharedKey, content.encryptedBody);
          return { body: plaintext, _decryptState: "ok" };
        } catch {
          return { body: "🔒 Unable to decrypt", _decryptState: "failed" };
        }
      };

      const updates = new Map();
      for (const message of pendingMessages) {
        const entry = {};
        if (needsDecryption(message)) entry.self = await decryptOne(message);
        if (needsDecryption(message.replyTo)) entry.replyTo = await decryptOne(message.replyTo);
        updates.set(message.id, entry);
      }
      if (cancelled || !updates.size) return;

      thread.setData((messages = []) =>
        messages.map((message) => {
          const entry = updates.get(message.id);
          if (!entry) return message;
          return {
            ...message,
            ...(entry.self || {}),
            replyTo: entry.replyTo ? { ...message.replyTo, ...entry.replyTo } : message.replyTo,
          };
        }),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId, selected?.isGroup, selected?.user?.publicKey, thread.data, thread, userId]);
};

export default useE2EDecryption;
