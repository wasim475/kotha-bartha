import { useEffect } from "react";
import { decryptMessage, deriveSharedKey } from "../../../utility/crypto";

// Decrypts any encrypted messages in the active thread as they arrive
// (initial load, realtime message:new/message:updated) — server never sees
// the plaintext, so this is the only place it exists on the receiving side.
const useE2EDecryption = ({ conversationId, selected, userId, thread }) => {
  useEffect(() => {
    if (!conversationId || selected?.isGroup) return undefined;
    const peerPublicKey = selected?.user?.publicKey;

    const pending = (thread.data || []).filter(
      (message) => message.encrypted && message._decryptState == null,
    );
    if (!pending.length) return undefined;

    let cancelled = false;

    (async () => {
      const sharedKey = peerPublicKey
        ? await deriveSharedKey(conversationId, peerPublicKey, userId)
        : null;
      if (cancelled) return;

      const updates = new Map();
      for (const message of pending) {
        if (!sharedKey) {
          updates.set(message.id, { body: "🔒 Unable to decrypt", _decryptState: "failed" });
          continue;
        }
        try {
          const plaintext = await decryptMessage(sharedKey, message.encryptedBody);
          updates.set(message.id, { body: plaintext, _decryptState: "ok" });
        } catch {
          updates.set(message.id, { body: "🔒 Unable to decrypt", _decryptState: "failed" });
        }
      }
      if (cancelled || !updates.size) return;

      thread.setData((messages = []) =>
        messages.map((message) =>
          updates.has(message.id) ? { ...message, ...updates.get(message.id) } : message,
        ),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId, selected?.isGroup, selected?.user?.publicKey, thread.data, thread, userId]);
};

export default useE2EDecryption;
