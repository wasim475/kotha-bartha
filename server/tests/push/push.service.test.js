const test = require("node:test");
const assert = require("node:assert/strict");
const { messagePushData, incomingCallPushData } = require("../../src/services/push.service");

test("message push has the conversation deep link and never includes message content", () => {
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
    title: "A friend",
    body: "You have a new message.",
  });
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
