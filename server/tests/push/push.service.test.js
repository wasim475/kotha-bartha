const test = require("node:test");
const assert = require("node:assert/strict");
const {
  messagePushData,
  messagePushRecipients,
  createPushDispatcher,
  createAdminMessaging,
  incomingCallPushData,
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
    apps: [],
    credential: {
      cert: (credentials) => ({ type: "service-account", clientEmail: credentials.client_email }),
      applicationDefault: () => ({ type: "application-default" }),
    },
    initializeApp(options, name) {
      const app = { ...options, name };
      this.apps.push(app);
      initialized.push(app);
      return app;
    },
    messaging: (app) => ({ app }),
  };

  createAdminMessaging(admin, "test-project", JSON.stringify({ client_email: "server@example.test" }));
  createAdminMessaging(admin, "test-project", null);

  assert.equal(initialized.length, 1);
  assert.equal(initialized[0].name, "kotha-barta-test-project");
  assert.equal(initialized[0].projectId, "test-project");
  assert.deepEqual(initialized[0].credential, {
    type: "service-account",
    clientEmail: "server@example.test",
  });
});

test("message dispatch fans out across devices once per message and installation", async () => {
  const sent = [];
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
    logger: silentLogger,
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
});

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
