import { useEffect } from "react";
import { LEGACY_DEVICE_ID, decryptMessage, deriveSharedKey, getDeviceId } from "../../../utility/crypto";

const needsDecryption = (conversation) =>
  conversation?.encrypted && conversation._lastMessageDecryptState == null;

// Decrypts the last-message preview shown under each 1-to-1 conversation's
// name in the conversation list. The server never stores plaintext for an
// encrypted conversation's `lastMessage` — just a "🔒 Encrypted message"
// placeholder (see contentFields in chat.routes.js) — so this mirrors
// useE2EDecryption's per-device decrypt logic, applied across every row in
// a conversation-list resource instead of one open thread.
const useConversationListDecryption = ({ resource, userId }) => {
  useEffect(() => {
    const list = resource.data || [];
    const pending = list.filter((conversation) => !conversation.isGroup && needsDecryption(conversation));
    if (!pending.length) return undefined;

    let cancelled = false;
    const myDeviceId = getDeviceId();

    (async () => {
      const decryptOne = async (conversation) => {
        if (conversation.encryptedPayloads?.length) {
          const mine = conversation.encryptedPayloads.find((payload) => payload.deviceId === myDeviceId);
          if (!mine || !conversation.senderPublicKey) return null;
          const sharedKey = await deriveSharedKey(conversation.id, conversation.senderPublicKey, userId);
          if (!sharedKey) return null;
          try {
            return await decryptMessage(sharedKey, mine);
          } catch {
            return null;
          }
        }

        if (conversation.encryptedBody?.ciphertext) {
          const peerPublicKeys = conversation.user?.publicKeys || [];
          const legacyPeerKey = peerPublicKeys.find((key) => key.deviceId === LEGACY_DEVICE_ID)?.jwk || null;
          if (!legacyPeerKey) return null;
          const sharedKey = await deriveSharedKey(conversation.id, legacyPeerKey, userId);
          if (!sharedKey) return null;
          try {
            return await decryptMessage(sharedKey, conversation.encryptedBody);
          } catch {
            return null;
          }
        }

        return null;
      };

      const updates = new Map();
      for (const conversation of pending) {
        updates.set(conversation.id, await decryptOne(conversation));
      }
      if (cancelled || !updates.size) return;

      resource.setData((current = []) =>
        current.map((conversation) => {
          if (!updates.has(conversation.id)) return conversation;
          const plaintext = updates.get(conversation.id);
          return {
            ...conversation,
            lastMessage: plaintext ?? conversation.lastMessage,
            _lastMessageDecryptState: plaintext ? "ok" : "failed",
          };
        }),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [resource, resource.data, userId]);
};

export default useConversationListDecryption;
