const test = require("node:test");
const assert = require("node:assert/strict");
const { messagePushData, notificationPushData } = require("../src/services/push.service");

test("message push contains stable destination IDs and never includes message content", () => {
  const data = messagePushData({ senderName: "Amina", conversationId: "c1", messageId: "m1", body: "secret" });
  assert.deepEqual(data, {
    type: "message",
    notificationId: "m1",
    conversationId: "c1",
    messageId: "m1",
    title: "Amina",
    body: "You have a new message.",
  });
  assert.equal(JSON.stringify(data).includes("secret"), false);
});

test("post reaction push carries post ID and the actual reaction type", () => {
  assert.deepEqual(notificationPushData({
    id: "n1",
    type: "post_reaction",
    actorName: "Amina",
    postId: "p1",
    payload: { reactionType: "love", message: "Amina reacted to your post." },
  }), {
    notificationId: "n1",
    type: "post_reaction",
    title: "Amina",
    body: "Amina reacted to your post. · Love",
    postId: "p1",
    reactionType: "love",
  });
});

test("comment and reply pushes keep their target IDs and bounded preview", () => {
  const data = notificationPushData({
    id: "n2",
    type: "post_comment",
    actorName: "Amina",
    postId: "p1",
    commentId: "c1",
    replyId: "r1",
    payload: { preview: "A comment preview", message: "Amina replied." },
  });
  assert.equal(data.postId, "p1");
  assert.equal(data.commentId, "c1");
  assert.equal(data.replyId, "r1");
  assert.equal(data.body, "A comment preview");
});
