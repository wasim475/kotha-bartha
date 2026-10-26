const test = require("node:test");
const assert = require("node:assert/strict");
const firebaseAdmin = require("firebase-admin");
const { getMessaging } = require("firebase-admin/messaging");
const {
  messagePushData,
  messagePushRecipients,
  createPushDispatcher,
  createAdminMessaging,
  incomingCallPushData,
  safeFirebaseErrorCode,
  safeErrorDetails,
} = require("../../src/services/push.service");

test("message push has generic copy and the conversation deep link, without message content", () => {
  const data = messagePushData({
    senderName: "A friend",
    conversationId: "conversation-1",
    messageId: "message-1",
    body: "plaintext must stay private",
    encryptedBody: { ciphertext: "ciphertext must stay private" },
  });

  assert.deepEqual(data, {
    type: "message",
    notificationId: "message-1",
    conversationId: "conversation-1",
    messageId: "message-1",
    title: "KothaX",
    body: "New message",
  });
});

test("message recipients come from conversation participants and exclude the sender", () => {
  assert.deepEqual(
    messagePushRecipients({ participantIds: ["sender", "recipient", "sender"] }, "sender"),
    ["recipient"],
  );
});

test("Firebase Admin Messaging is initialized with server credentials or ADC", () => {
  const initialized = [];
  const admin = {
    getApps: () => initialized,
    cert: (credentials) => ({ type: "service-account", clientEmail: credentials.client_email }),
    applicationDefault: () => ({ type: "application-default" }),
    initializeApp(options, name) {
      const app = { ...options, name };
      initialized.push(app);
      return app;
    },
  };

  createAdminMessaging(admin, "test-project", JSON.stringify({ client_email: "server@example.test" }), {
    messagingGetter: (app) => ({ app }),
  });
  createAdminMessaging(admin, "test-project", null, { messagingGetter: (app) => ({ app }) });

  assert.equal(initialized.length, 1);
  assert.equal(initialized[0].name, "kotha-barta-test-project");
  assert.equal(initialized[0].projectId, "test-project");
  assert.deepEqual(initialized[0].credential, {
    type: "service-account",
    clientEmail: "server@example.test",
  });

  const adcApps = [];
  const adcAdmin = {
    getApps: () => adcApps,
    cert: () => { throw new Error("service-account credential should not be used"); },
    applicationDefault: () => ({ type: "application-default" }),
    initializeApp(options, name) {
      const app = { ...options, name };
      adcApps.push(app);
      return app;
    },
  };
  createAdminMessaging(adcAdmin, "adc-test-project", null, { messagingGetter: (app) => ({ app }) });
  assert.deepEqual(adcApps[0].credential, { type: "application-default" });
});

test("Firebase Admin reuses an existing app for the configured project", () => {
  const existingApp = { name: "[DEFAULT]", options: { projectId: "kothax-14bd0" } };
  const admin = {
    getApps: () => [existingApp],
    applicationDefault: () => ({ type: "application-default" }),
    initializeApp() { throw new Error("must not initialize a duplicate app"); },
  };

  const messaging = createAdminMessaging(admin, "kothax-14bd0", null, { messagingGetter: (app) => ({ app }) });

  assert.equal(messaging.app, existingApp);
  assert.equal(admin.getApps().length, 1);
});

test("Firebase Admin 14 modular exports initialize and reuse messaging successfully", async () => {
  assert.equal(typeof firebaseAdmin.getApps, "function");
  assert.equal(typeof firebaseAdmin.cert, "function");
  assert.equal(typeof firebaseAdmin.applicationDefault, "function");
  assert.equal(typeof firebaseAdmin.initializeApp, "function");
  assert.equal("apps" in firebaseAdmin, false);
  const projectId = `push-sdk-test-${process.pid}-${Date.now()}`;
  let app;
  try {
    const messaging = createAdminMessaging(firebaseAdmin, projectId, null);
    app = messaging.app;
    assert.equal(typeof messaging.send, "function");
    const reusedMessaging = createAdminMessaging(firebaseAdmin, projectId, null);
    assert.equal(reusedMessaging.app, app);
    assert.equal(firebaseAdmin.getApps().filter((candidate) => candidate.options.projectId === projectId).length, 1);
  } finally {
    if (app) await firebaseAdmin.deleteApp(app);
  }
});

test("message dispatch fans out across devices once per message and installation", async () => {
  const sent = [];
  const logs = [];
  const claimed = new Set();
  const devices = [
    { installationId: "install-a", token: "token-a" },
    { installationId: "install-b", token: "token-b" },
  ];
  const userModel = fakeUserModel(devices);
  const messageModel = {
    async updateOne(query) {
      const key = `${query._id}:${query.pushAttemptedInstallationIds.$ne}`;
      if (claimed.has(key)) return { modifiedCount: 0 };
      claimed.add(key);
      return { modifiedCount: 1 };
    },
  };
  const dispatcher = createPushDispatcher({
    userModel,
    messageModel,
    env: { FCM_PROJECT_ID: "test-project" },
    messagingFactory: fakeMessagingFactory(async (message) => {
      sent.push(message.token);
      assert.deepEqual(message.data, {
        type: "message",
        notificationId: "message-1",
        conversationId: "conversation-1",
        messageId: "message-1",
        title: "KothaX",
        body: "New message",
      });
      assert.equal(JSON.stringify(message).includes("plaintext"), false);
    }),
    logger: {
      ...silentLogger,
      info: (message, details) => logs.push({ level: "info", message, details }),
      warn: (message, details) => logs.push({ level: "warn", message, details }),
    },
  });

  await dispatcher.sendNewMessagePush({
    recipientIds: ["recipient"],
    conversationId: "conversation-1",
    messageId: "message-1",
  });
  await dispatcher.sendNewMessagePush({
    recipientIds: ["recipient"],
    conversationId: "conversation-1",
    messageId: "message-1",
  });

  assert.deepEqual(sent, ["token-a", "token-b"]);
  assert.deepEqual(logs.map(({ details }) => details), [
    { recipientCount: 1, deviceCount: 2, sentCount: 2, failedCount: 0, deduplicatedCount: 0, missingTokenCount: 0 },
    { recipientCount: 1, deviceCount: 2, sentCount: 0, failedCount: 0, deduplicatedCount: 2, missingTokenCount: 0 },
  ]);
  assert.equal(JSON.stringify(logs).includes("token-a"), false);
  assert.equal(JSON.stringify(logs).includes("message-1"), false);
});

test("push diagnostics report no registered recipient devices without exposing identifiers", async () => {
  const logs = [];
  const dispatcher = createPushDispatcher({
    userModel: fakeUserModel([]),
    messageModel: { updateOne: async () => ({ modifiedCount: 1 }) },
    env: { FCM_PROJECT_ID: "test-project" },
    messagingFactory: fakeMessagingFactory(async () => {}),
    logger: {
      ...silentLogger,
      warn: (message, details) => logs.push({ message, details }),
    },
  });

  await dispatcher.sendNewMessagePush({
    recipientIds: ["user-secret-id"],
    conversationId: "conversation-1",
    messageId: "message-4",
  });

  assert.deepEqual(logs, [{
    message: "FCM push skipped: no registered recipient devices",
    details: { recipientCount: 1 },
  }]);
  assert.equal(JSON.stringify(logs).includes("user-secret-id"), false);
});

test("Firebase error diagnostics accept only sanitized SDK code strings", () => {
  assert.equal(safeFirebaseErrorCode({ code: "messaging/invalid-argument" }), "messaging/invalid-argument");
  assert.equal(safeFirebaseErrorCode({ code: "invalid code with token-secret" }), undefined);
  assert.equal(safeFirebaseErrorCode(new Error("private failure detail")), undefined);
});

test("Firebase initialization failure logs stage, safe class, and provider code without secrets", async () => {
  const logs = capturedErrors();
  const dispatcher = createPushDispatcher({
    userModel: fakeUserModel([]),
    env: { FCM_PROJECT_ID: "test-project", FCM_SERVICE_ACCOUNT_JSON: "private-key-secret" },
    messagingFactory: (_admin, _projectId, _credentials, { onStage }) => {
      onStage("application-default-credential");
      const error = new Error("private-key-secret token-secret");
      error.code = "app/invalid-credential";
      return Promise.reject(error);
    },
    logger: logs.logger,
  });
  await dispatcher.sendDataPush(["user-secret-id"], { body: "plaintext-secret" });
  assert.deepEqual(logs.entries[0].details, {
    stage: "firebase-initialization",
    substage: "application-default-credential",
    errorClass: "Error",
    firebaseCode: "app/invalid-credential",
  });
  assertSanitized(logs.entries);
});

test("recipient lookup failure identifies its stage and sanitized database code", async () => {
  const logs = capturedErrors();
  const userModel = { find: () => { const error = new Error("token-secret user-secret-id"); error.name = "MongoServerError"; error.code = 91; throw error; } };
  const dispatcher = createPushDispatcher({
    userModel,
    env: { FCM_PROJECT_ID: "test-project" },
    messagingFactory: fakeMessagingFactory(async () => {}),
    logger: logs.logger,
  });
  await dispatcher.sendDataPush(["user-secret-id"], { body: "ciphertext-secret" });
  assert.deepEqual(logs.entries[0].details, { stage: "recipient-lookup", errorClass: "MongoServerError", databaseCode: 91 });
  assertSanitized(logs.entries);
});

test("device lookup failure and errors without codes retain stage and error class", async () => {
  const logs = capturedErrors();
  const dispatcher = createPushDispatcher({
    userModel: { find: () => ({ select() { return this; }, lean: async () => ({ pushDevices: [{ token: "raw-fcm-token-secret" }] }) }) },
    env: { FCM_PROJECT_ID: "test-project" },
    messagingFactory: fakeMessagingFactory(async () => {}),
    logger: logs.logger,
  });
  await dispatcher.sendDataPush(["recipient-id-secret"], { body: "plaintext-secret" });
  assert.deepEqual(logs.entries[0].details, { stage: "device-lookup", errorClass: "TypeError" });
  assert.deepEqual(safeErrorDetails(new Error("service-account-secret"), "firebase-initialization"), {
    stage: "firebase-initialization", errorClass: "Error",
  });
  assertSanitized(logs.entries);
});

test("failed message sends stay claimed and are not automatically retried", async () => {
  let claims = 0;
  let sends = 0;
  const claimed = new Set();
  const dispatcher = createPushDispatcher({
    userModel: fakeUserModel([{ installationId: "install-secret", token: "raw-fcm-token-secret" }]),
    messageModel: { updateOne: async (filter) => {
      claims += 1;
      const key = `${filter._id}:${filter.pushAttemptedInstallationIds.$ne}`;
      if (claimed.has(key)) return { modifiedCount: 0 };
      claimed.add(key);
      return { modifiedCount: 1 };
    } },
    env: { FCM_PROJECT_ID: "test-project" },
    messagingFactory: fakeMessagingFactory(async () => { sends += 1; throw new Error("transient-secret"); }),
    logger: { error() {}, info() {} },
  });
  await dispatcher.sendNewMessagePush({ recipientIds: ["recipient-id-secret"], conversationId: "conversation-secret", messageId: "message-secret" });
  await dispatcher.sendNewMessagePush({ recipientIds: ["recipient-id-secret"], conversationId: "conversation-secret", messageId: "message-secret" });
  assert.equal(claims, 2);
  assert.equal(sends, 1);
});

function capturedErrors() {
  const entries = [];
  return { entries, logger: { ...silentLogger, error: (message, details) => entries.push({ message, details }) } };
}

function assertSanitized(entries) {
  const serialized = JSON.stringify(entries);
  for (const secret of ["raw-fcm-token-secret", "private-key-secret", "service-account-secret", "plaintext-secret", "ciphertext-secret", "user-secret-id", "recipient-id-secret", "install-secret"]) {
    assert.equal(serialized.includes(secret), false, `diagnostics exposed ${secret}`);
  }
}

test("FCM failure on one device does not throw or stop another device", async () => {
  const sent = [];
  const devices = [
    { installationId: "install-a", token: "bad-token" },
    { installationId: "install-b", token: "good-token" },
  ];
  const dispatcher = createPushDispatcher({
    userModel: fakeUserModel(devices),
    messageModel: { updateOne: async () => ({ modifiedCount: 1 }) },
    env: { FCM_PROJECT_ID: "test-project" },
    messagingFactory: fakeMessagingFactory(async ({ token }) => {
      if (token === "bad-token") throw new Error("provider unavailable");
      sent.push(token);
    }),
    logger: silentLogger,
  });

  await assert.doesNotReject(dispatcher.sendNewMessagePush({
    recipientIds: ["recipient"],
    conversationId: "conversation-1",
    messageId: "message-2",
  }));
  assert.deepEqual(sent, ["good-token"]);
});

test("unregistered FCM tokens are removed only from the matching installation", async () => {
  const cleanup = [];
  const userModel = fakeUserModel([
    { installationId: "install-a", token: "unregistered" },
    { installationId: "install-b", token: "valid" },
  ]);
  userModel.updateOne = async (...args) => cleanup.push(args);
  const dispatcher = createPushDispatcher({
    userModel,
    messageModel: { updateOne: async () => ({ modifiedCount: 1 }) },
    env: { FCM_PROJECT_ID: "test-project" },
    messagingFactory: fakeMessagingFactory(async ({ token }) => {
      if (token === "unregistered") {
        const error = new Error("unregistered");
        error.code = "messaging/registration-token-not-registered";
        throw error;
      }
    }),
    logger: silentLogger,
  });

  await dispatcher.sendNewMessagePush({
    recipientIds: ["recipient"],
    conversationId: "conversation-1",
    messageId: "message-3",
  });
  assert.deepEqual(cleanup, [[
    { _id: "recipient" },
    { $pull: { pushDevices: { installationId: "install-a", token: "unregistered" } } },
  ]]);
});

test("incoming call push carries only call routing and media type", () => {
  const data = incomingCallPushData({
    callerName: "A friend",
    callId: "call-1",
    conversationId: "conversation-1",
    video: false,
  });

  assert.deepEqual(data, {
    type: "call",
    callId: "call-1",
    conversationId: "conversation-1",
    video: "false",
    title: "A friend",
    body: "Incoming audio call",
  });
});

function fakeUserModel(devices) {
  return {
    find: () => ({
      select() { return this; },
      lean: async () => [{ _id: "recipient", pushDevices: devices }],
    }),
    updateOne: async () => undefined,
  };
}

const fakeMessagingFactory = (send) => () => ({ send });

const silentLogger = { error() {} };
