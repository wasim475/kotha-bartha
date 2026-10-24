const { createPublicKey } = require("node:crypto");

const MESSAGE_SECURITY_MODES = Object.freeze({
  LEGACY: "legacy",
  E2EE: "e2ee",
});
const MAX_CIPHERTEXT_LENGTH = 20000;
const MAX_DEVICE_TARGETS = 20;

const canonicalBase64InRange = (value, minBytes, maxBytes) => {
  if (typeof value !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return false;
  const decoded = Buffer.from(value, "base64");
  return decoded.toString("base64") === value && decoded.length >= minBytes && decoded.length <= maxBytes;
};

// Structural validation for the Web client envelope. This does not prove
// that a sender performed ECDH/AES-GCM or that the payload decrypts.
function isValidCurrentEncryptedEnvelope(payload) {
  const entries = payload?.encryptedPayloads;
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > MAX_DEVICE_TARGETS) return false;
  if (!entries.every((entry) =>
    entry && typeof entry.deviceId === "string" && entry.deviceId.length > 0 && entry.deviceId.length <= 100 &&
    canonicalBase64InRange(entry.iv, 12, 12) && canonicalBase64InRange(entry.ciphertext, 16, MAX_CIPHERTEXT_LENGTH),
  )) return false;
  if (new Set(entries.map((entry) => entry.deviceId)).size !== entries.length) return false;
  if (typeof payload.senderPublicKey !== "string" || payload.senderPublicKey.length > 2000) return false;
  try {
    const jwk = JSON.parse(payload.senderPublicKey);
    if (jwk?.kty !== "EC" || jwk?.crv !== "P-256") return false;
    for (const coordinate of [jwk.x, jwk.y]) {
      if (typeof coordinate !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(coordinate)) return false;
      if (Buffer.from(coordinate.replace(/-/g, "+").replace(/_/g, "/"), "base64").length !== 32) return false;
    }
    createPublicKey({ key: jwk, format: "jwk" });
    return true;
  } catch {
    return false;
  }
}

// Missing fields are legacy for pre-existing Mongo documents and for new
// conversations until a separately reviewed, server-controlled activation
// flow can prove every participant's device readiness.
function getMessageSecurityMode(conversation) {
  return conversation?.messageSecurityMode === MESSAGE_SECURITY_MODES.E2EE
    ? MESSAGE_SECURITY_MODES.E2EE
    : MESSAGE_SECURITY_MODES.LEGACY;
}

function createMessageSecurityError(code, message) {
  const error = new Error(message);
  error.status = 409;
  error.code = code;
  return error;
}

function assertMessageWriteAllowed({ conversation, type = "text", encrypted = false, envelopeFormat = null, envelopeValid = false }) {
  if (getMessageSecurityMode(conversation) !== MESSAGE_SECURITY_MODES.E2EE) return;

  // Current conversation-level mode supports text only. The multi-device
  // envelope shape is required; the encrypted flag itself is not proof that
  // the contents are cryptographically valid.
  if (conversation.isGroup) {
    throw createMessageSecurityError("UNSUPPORTED_E2EE_MESSAGE", "Encrypted groups are not enabled for this conversation.");
  }
  if (type !== "text") {
    throw createMessageSecurityError("UNSUPPORTED_E2EE_MESSAGE", "This message type is unavailable in this conversation.");
  }
  if (!encrypted || envelopeFormat !== "multi-device" || !envelopeValid) {
    throw createMessageSecurityError("E2EE_ENCRYPTION_REQUIRED", "An encrypted message is required for this conversation.");
  }
}

function assertClientCannotChangeMessageSecurityMode(body) {
  if (body && Object.prototype.hasOwnProperty.call(body, "messageSecurityMode")) {
    throw createMessageSecurityError("FORBIDDEN_SECURITY_MODE_CHANGE", "Conversation security mode is managed by the server.");
  }
}

module.exports = {
  MESSAGE_SECURITY_MODES,
  getMessageSecurityMode,
  assertMessageWriteAllowed,
  assertClientCannotChangeMessageSecurityMode,
  isValidCurrentEncryptedEnvelope,
};
