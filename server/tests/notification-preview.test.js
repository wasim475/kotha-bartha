const test = require("node:test");
const assert = require("node:assert/strict");
const Conversation = require("../src/models/Conversation");
const Message = require("../src/models/Message");
const chatRouter = require("../src/routes/chat.routes");

const routePath = "/conversations/:conversationId/messages/:messageId/notification-preview";
const handler = chatRouter.stack.find((entry) => entry.route?.path === routePath)?.route?.stack.at(-1)?.handle;

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("notification preview lookup is participant scoped and does not mark messages read", async () => {
  assert.equal(typeof handler, "function");
  const originals = { conversationFindOne: Conversation.findOne, messageFindOne: Message.findOne };
  const calls = [];
  try {
    Conversation.findOne = (query) => {
      calls.push(["conversation", query]);
      return { select: async () => ({ _id: "conversation-id" }) };
    };
    Message.findOne = (query) => {
      calls.push(["message", query]);
      return {
        populate() { return this; },
        async lean() {
          return {
            _id: "message-id",
            senderId: { _id: "sender-id", fullName: "Alice", avatar: null },
            body: "safe preview after authenticated fetch",
            type: "text",
            createdAt: new Date("2026-01-01T00:00:00Z"),
            status: "sent",
          };
        },
      };
    };
    const response = responseRecorder();
    await handler({
      user: { _id: "recipient-id" },
      params: { conversationId: "conversation-id", messageId: "message-id" },
    }, response, (error) => { throw error; });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data.id, "message-id");
    assert.equal(response.body.data.sender.fullName, "Alice");
    assert.deepEqual(calls[0][1], { _id: "conversation-id", participantIds: "recipient-id" });
    assert.equal(calls[1][1].conversationId, "conversation-id");
    assert.equal(calls[1][1].deletedFor.$ne, "recipient-id");
    assert.ok(calls.every(([name]) => name !== "updateMany"));
  } finally {
    Conversation.findOne = originals.conversationFindOne;
    Message.findOne = originals.messageFindOne;
  }
});

test("notification preview lookup returns not found for a nonmember", async () => {
  const original = Conversation.findOne;
  try {
    Conversation.findOne = () => ({ select: async () => null });
    const response = responseRecorder();
    await handler({ user: { _id: "account-id" }, params: { conversationId: "other", messageId: "message" } }, response, (error) => { throw error; });
    assert.equal(response.statusCode, 404);
    assert.equal(response.body.error.code, "NOT_FOUND");
  } finally {
    Conversation.findOne = original;
  }
});
