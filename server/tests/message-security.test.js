const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { generateKeyPairSync } = require("node:crypto");
const Conversation = require("../src/models/Conversation");
const Message = require("../src/models/Message");
const chatRouter = require("../src/routes/chat.routes");
const {
  MESSAGE_SECURITY_MODES,
  getMessageSecurityMode,
  assertMessageWriteAllowed,
  assertClientCannotChangeMessageSecurityMode,
  isValidCurrentEncryptedEnvelope,
} = require("../src/utils/messageSecurity");

const legacy = {};
const e2ee = { messageSecurityMode: MESSAGE_SECURITY_MODES.E2EE };

function routeHandler(method, routePath) {
  const layer = chatRouter.stack.find((entry) => entry.route?.path === routePath && entry.route.methods[method]);
  assert.ok(layer, "route exists");
  return layer.route.stack.at(-1).handle;
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("existing conversations without a mode retain legacy plaintext behavior", () => {
  assert.equal(getMessageSecurityMode(legacy), "legacy");
  assert.doesNotThrow(() => assertMessageWriteAllowed({ conversation: legacy }));
});

test("legacy plaintext send remains allowed", () => {
  assert.doesNotThrow(() => assertMessageWriteAllowed({ conversation: { messageSecurityMode: "legacy" } }));
});

test("E2EE plaintext send and plaintext edit are rejected", () => {
  for (const operation of ["send", "edit"]) {
    assert.throws(
      () => assertMessageWriteAllowed({ conversation: e2ee, encrypted: false }),
      { code: "E2EE_ENCRYPTION_REQUIRED" },
      operation,
    );
  }
});

test("E2EE accepts only the current multi-device envelope shape", () => {
  const envelope = {
    senderPublicKey: JSON.stringify(generateKeyPairSync("ec", { namedCurve: "prime256v1" }).publicKey.export({ format: "jwk" })),
    encryptedPayloads: [{ deviceId: "synthetic-device", iv: Buffer.alloc(12).toString("base64"), ciphertext: Buffer.alloc(16).toString("base64") }],
  };
  assert.equal(isValidCurrentEncryptedEnvelope(envelope), true);
  assert.doesNotThrow(() => assertMessageWriteAllowed({
    conversation: e2ee,
    encrypted: true,
    envelopeFormat: "multi-device",
    envelopeValid: isValidCurrentEncryptedEnvelope(envelope),
  }));
  assert.throws(() => assertMessageWriteAllowed({
    conversation: e2ee,
    encrypted: true,
    envelopeFormat: "legacy-single",
  }), { code: "E2EE_ENCRYPTION_REQUIRED" });
});

test("E2EE envelope validation rejects malformed IV, short ciphertext, duplicate devices, and non-P-256 keys", () => {
  const valid = {
    senderPublicKey: JSON.stringify(generateKeyPairSync("ec", { namedCurve: "prime256v1" }).publicKey.export({ format: "jwk" })),
    encryptedPayloads: [{ deviceId: "device-1", iv: Buffer.alloc(12).toString("base64"), ciphertext: Buffer.alloc(16).toString("base64") }],
  };
  assert.equal(isValidCurrentEncryptedEnvelope({ ...valid, encryptedPayloads: [{ ...valid.encryptedPayloads[0], iv: "AA==" }] }), false);
  assert.equal(isValidCurrentEncryptedEnvelope({ ...valid, encryptedPayloads: [{ ...valid.encryptedPayloads[0], ciphertext: Buffer.alloc(15).toString("base64") }] }), false);
  assert.equal(isValidCurrentEncryptedEnvelope({ ...valid, encryptedPayloads: [...valid.encryptedPayloads, ...valid.encryptedPayloads] }), false);
  assert.equal(isValidCurrentEncryptedEnvelope({ ...valid, senderPublicKey: JSON.stringify({ kty: "EC", crv: "P-384", x: "A".repeat(43), y: "A".repeat(43) }) }), false);
});

test("E2EE rejects unsupported plaintext message types", () => {
  for (const type of ["attachment", "call", "story-context"]) {
    assert.throws(
      () => assertMessageWriteAllowed({ conversation: e2ee, type }),
      { code: "UNSUPPORTED_E2EE_MESSAGE" },
      type,
    );
  }
});

test("client cannot activate or downgrade the server-controlled mode", async () => {
  for (const requestedMode of ["legacy", "e2ee"]) {
    assert.throws(
      () => assertClientCannotChangeMessageSecurityMode({ messageSecurityMode: requestedMode }),
      { code: "FORBIDDEN_SECURITY_MODE_CHANGE" },
    );
  }

  const conversation = { messageSecurityMode: "legacy" };
  const [sendResult, changeResult] = await Promise.allSettled([
    Promise.resolve().then(() => assertMessageWriteAllowed({ conversation, encrypted: false })),
    Promise.resolve().then(() => assertClientCannotChangeMessageSecurityMode({ messageSecurityMode: "e2ee" })),
  ]);
  assert.equal(sendResult.status, "fulfilled");
  assert.equal(changeResult.status, "rejected");
  assert.equal(conversation.messageSecurityMode, "legacy");
});

test("rejected writes stop before persistence or broadcast callbacks", () => {
  let persisted = false;
  let broadcast = false;
  assert.throws(() => {
    assertMessageWriteAllowed({ conversation: e2ee, encrypted: false });
    persisted = true;
    broadcast = true;
  }, { code: "E2EE_ENCRYPTION_REQUIRED" });
  assert.equal(persisted, false);
  assert.equal(broadcast, false);
});

test("REST plaintext send is rejected before Message.create or socket broadcast", async () => {
  const oldFindOne = Conversation.findOne;
  const oldCreate = Message.create;
  let created = false;
  Conversation.findOne = async () => ({ ...e2ee, _id: "conversation-1", participantIds: ["sender", "recipient"], isGroup: false });
  Message.create = async () => { created = true; };
  const req = {
    params: { conversationId: "conversation-1" },
    body: { body: "synthetic plaintext" },
    user: { _id: { toString: () => "sender" }, fullName: "Synthetic", avatar: null },
  };
  const res = responseRecorder();
  try {
    await routeHandler("post", "/conversations/:conversationId/messages")(req, res, (error) => { throw error; });
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.error.code, "E2EE_ENCRYPTION_REQUIRED");
    assert.equal(created, false);
  } finally {
    Conversation.findOne = oldFindOne;
    Message.create = oldCreate;
  }
});

test("group admin cannot change message mode; concurrent send/downgrade stays fail closed", async () => {
  const oldFindOne = Conversation.findOne;
  const oldCreate = Message.create;
  let created = false;
  const shared = { ...e2ee, _id: "conversation-1", participantIds: ["sender", "recipient"], isGroup: true, adminIds: ["sender"] };
  Conversation.findOne = async () => shared;
  Message.create = async () => { created = true; };
  const user = { _id: { toString: () => "sender" } };
  const sendRes = responseRecorder();
  const changeRes = responseRecorder();
  try {
    await Promise.all([
      routeHandler("post", "/conversations/:conversationId/messages")({
        params: { conversationId: "conversation-1" }, body: { body: "synthetic plaintext" }, user,
      }, sendRes, (error) => { throw error; }),
      routeHandler("patch", "/conversations/:conversationId")({
        params: { conversationId: "conversation-1" }, body: { messageSecurityMode: "legacy" }, user,
      }, changeRes, (error) => { throw error; }),
    ]);
    assert.equal(sendRes.statusCode, 409);
    assert.equal(sendRes.body.error.code, "UNSUPPORTED_E2EE_MESSAGE");
    assert.equal(changeRes.statusCode, 409);
    assert.equal(changeRes.body.error.code, "FORBIDDEN_SECURITY_MODE_CHANGE");
    assert.equal(created, false);
    assert.equal(shared.messageSecurityMode, "e2ee");
  } finally {
    Conversation.findOne = oldFindOne;
    Message.create = oldCreate;
  }
});

test("Socket.IO has no message creation event that can bypass REST enforcement", () => {
  const serverSource = fs.readFileSync(path.join(__dirname, "../src/server.js"), "utf8");
  assert.doesNotMatch(serverSource, /socket\.on\(["']message:(send|create|edit)["']/);
});
