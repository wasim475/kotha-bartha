import { useEffect } from "react";
import { LEGACY_DEVICE_ID, decryptMessage, deriveSharedKey, getDeviceId } from "../../../utility/crypto";

const needsDecryption = (content) => content?.encrypted && content._decryptState == null;

// Decrypts any encrypted messages (and encrypted reply-quote previews) in
// the active thread as they arrive — initial load, realtime message:new
// (which reloads the thread), and reconnect. Server never sees the
// plaintext, so this is the only place it exists on the receiving side.
//
// Handles two message shapes: the current multi-device format
// (`encryptedPayloads` — one ciphertext addressed to each known device,
// decrypted here by picking out *this* device's own entry and deriving
// against whichever key produced it, `senderPublicKey`) and the legacy
// single-shared-key format (`encryptedBody` — one ciphertext for the whole
// conversation, decryptable only by whichever device still holds the
// original pre-multi-device keypair, matched via the peer's "legacy"
// public key entry).
const useE2EDecryption = ({ conversationId, selected, userId, thread }) => {
  useEffect(() => {
    if (!conversationId || selected?.isGroup) return undefined;
    const peerPublicKeys = selected?.user?.publicKeys || [];

    const pendingMessages = (thread.data || []).filter(
      (message) => needsDecryption(message) || needsDecryption(message.replyTo),
    );
    if (!pendingMessages.length) return undefined;

    // The peer's keys haven't loaded yet (e.g. the conversation list fetch
    // that carries them hasn't resolved) — this is transient, not a real
    // failure, so leave these messages untouched rather than marking them
    // permanently "failed". The effect re-runs and retries as soon as
    // `selected.user.publicKeys` actually has entries (see the dependency
    // array below) instead of getting stuck forever on a one-time miss.
    if (!peerPublicKeys.length) return undefined;

    const legacyPeerKey =
      peerPublicKeys.find((key) => key.deviceId === LEGACY_DEVICE_ID)?.jwk || null;

    let cancelled = false;
    const myDeviceId = getDeviceId();

    (async () => {
      const decryptOne = async (content) => {
        // Current multi-device format: find the payload addressed to this
        // exact device, and derive using whichever key produced it —
        // could be the peer's, or one of this account's own other
        // devices, for a message this account sent itself.
        if (content.encryptedPayloads?.length) {
          const mine = content.encryptedPayloads.find((payload) => payload.deviceId === myDeviceId);
          if (!mine || !content.senderPublicKey) {
            return { body: "🔒 Unable to decrypt", _decryptState: "failed" };
          }
          const sharedKey = await deriveSharedKey(conversationId, content.senderPublicKey, userId);
          if (!sharedKey) return { body: "🔒 Unable to decrypt", _decryptState: "failed" };
          try {
            const plaintext = await decryptMessage(sharedKey, mine);
            return { body: plaintext, _decryptState: "ok" };
          } catch {
            return { body: "🔒 Unable to decrypt", _decryptState: "failed" };
          }
        }

        // Legacy single-shared-key format.
        if (content.encryptedBody) {
          if (!legacyPeerKey) return { body: "🔒 Unable to decrypt", _decryptState: "failed" };
          const sharedKey = await deriveSharedKey(conversationId, legacyPeerKey, userId);
          if (!sharedKey) return { body: "🔒 Unable to decrypt", _decryptState: "failed" };
          try {
            const plaintext = await decryptMessage(sharedKey, content.encryptedBody);
            return { body: plaintext, _decryptState: "ok" };
          } catch {
            return { body: "🔒 Unable to decrypt", _decryptState: "failed" };
          }
        }

        return { body: "🔒 Unable to decrypt", _decryptState: "failed" };
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
  }, [conversationId, selected?.isGroup, selected?.user?.publicKeys, thread.data, thread, userId]);
};

export default useE2EDecryption;
