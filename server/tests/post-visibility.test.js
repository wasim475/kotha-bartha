const test = require("node:test");
const assert = require("node:assert/strict");
const Friendship = require("../src/models/Friendship");
const Block = require("../src/models/Block");
const { canViewPost } = require("../src/utils/postVisibility");

const originalFriendshipExists = Friendship.exists;
const originalBlockExists = Block.exists;

test.after(() => {
  Friendship.exists = originalFriendshipExists;
  Block.exists = originalBlockExists;
});

test("post author can always view their own post without relationship lookups", async () => {
  Friendship.exists = () => { throw new Error("unexpected friendship lookup"); };
  Block.exists = () => { throw new Error("unexpected block lookup"); };
  assert.equal(await canViewPost("u1", "u1"), true);
});

test("accepted friends can view a post if neither has blocked the other", async () => {
  Friendship.exists = async (query) => query.userIds.$all.join(",") === "u1,u2";
  Block.exists = async () => false;
  assert.equal(await canViewPost("u1", "u2"), true);
});

test("non-friends cannot view posts regardless of any public profile setting", async () => {
  Friendship.exists = async () => false;
  Block.exists = async () => false;
  assert.equal(await canViewPost("u1", "u2"), false);
});

test("a block in either direction revokes post visibility even if friendship data is stale", async () => {
  Friendship.exists = async () => true;
  Block.exists = async (query) => {
    const [first, second] = query.$or;
    return first.blockerId === "u1" && first.blockedId === "u2" &&
      second.blockerId === "u2" && second.blockedId === "u1";
  };
  assert.equal(await canViewPost("u1", "u2"), false);
});

test("a pending friend request cannot grant post visibility", async () => {
  // FriendRequest is intentionally not consulted: only Friendship records represent accepted pairs.
  Friendship.exists = async () => false;
  Block.exists = async () => false;
  assert.equal(await canViewPost("pending-viewer", "author"), false);
});
