const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Reaction = require("../models/Reaction");
const Notification = require("../models/Notification");
const Friendship = require("../models/Friendship");
const FriendRequest = require("../models/FriendRequest");
const Block = require("../models/Block");
const Story = require("../models/Story");
const Note = require("../models/Note");
const User = require("../models/User");
const { destroyAsset } = require("../utils/cloudinary");
const { VISIBLE_CONTENT } = require("../utils/moderation");

// Everything that removes or hides user-generated content lives here, so the
// author's own delete buttons and the Admin Panel run the SAME cascades (assets,
// reactions, notifications) instead of two copies that can drift apart.

// ---- Deleting a post ---------------------------------------------------

// Soft-deletes one post that matches `filter` (an author deleting their own post
// passes `authorId`; an admin does not) and cleans up after it. `extra` is merged
// into the update (the admin path marks it moderationStatus "deleted"). Returns
// the post, or null if nothing matched (already deleted, or not theirs).
async function softDeletePost(filter, extra = {}) {
  const post = await Post.findOneAndUpdate(
    { ...filter, deletedAt: null },
    { $set: { deletedAt: new Date(), ...extra } },
    { new: true },
  );
  if (!post) return null;

  if (post.media?.length) {
    await Promise.all(post.media.map((item) => destroyAsset(item.publicId, "image")));
  }
  // Every notification about this post (reactions, comments and replies alike)
  // points at content that no longer exists.
  await Notification.deleteMany({ postId: post._id });
  return post;
}

// ---- Deleting a comment / reply -----------------------------------------

// All descendant comment ids (replies, and replies to replies) under a comment.
async function collectDescendantIds(rootId) {
  const ids = [];
  let frontier = [rootId];
  while (frontier.length) {
    const children = await Comment.find({ parentId: { $in: frontier } })
      .select("_id")
      .lean();
    const childIds = children.map((child) => child._id);
    ids.push(...childIds);
    frontier = childIds;
  }
  return ids;
}

// Deletes a comment or reply together with everything replying to it, and the
// reactions and notifications that point at any of them. Replies elsewhere in the
// same thread are untouched. `existing` needs `_id` and `parentId`.
async function deleteCommentThread(existing) {
  const isReply = Boolean(existing.parentId);
  const descendantIds = await collectDescendantIds(existing._id);
  const allIds = [existing._id, ...descendantIds];

  await Comment.deleteMany({ _id: { $in: allIds } });
  await Reaction.deleteMany({ targetType: "comment", targetId: { $in: allIds } });

  if (isReply) {
    await Notification.deleteMany({ replyId: { $in: allIds } });
  } else {
    await Notification.deleteMany({ commentId: existing._id });
  }
  return allIds;
}

// ---- Bans: reversible hiding --------------------------------------------

// Hides everything the user currently shows to others. Only content that is
// visible right now is touched: an item an admin already deleted keeps its
// "deleted" state, so an unban can never bring it back.
async function hideContentForBan(userId, admin) {
  const stamp = { moderationStatus: "hidden_by_ban", hiddenReason: "author_banned", moderatedAt: new Date(), moderatedBy: admin._id };
  const [posts, comments] = await Promise.all([
    Post.updateMany({ authorId: userId, deletedAt: null, ...VISIBLE_CONTENT }, { $set: stamp }),
    Comment.updateMany({ authorId: userId, ...VISIBLE_CONTENT }, { $set: stamp }),
  ]);
  return { posts: posts.modifiedCount, comments: comments.modifiedCount };
}

// Restores ONLY what the ban hid (reason "author_banned"). Posts the author or an
// admin deleted individually are not in that set, so they stay deleted.
async function restoreContentAfterUnban(userId) {
  const restore = { $set: { moderationStatus: "visible", hiddenReason: null } };
  const [posts, comments] = await Promise.all([
    Post.updateMany({ authorId: userId, deletedAt: null, moderationStatus: "hidden_by_ban", hiddenReason: "author_banned" }, restore),
    Comment.updateMany({ authorId: userId, moderationStatus: "hidden_by_ban", hiddenReason: "author_banned" }, restore),
  ]);
  return { posts: posts.modifiedCount, comments: comments.modifiedCount };
}

// ---- Permanent account deletion ------------------------------------------

// What "delete a user" means here (decided from the existing models, not invented):
//   removed  : their posts (soft-deleted, photos destroyed), comments and replies
//              (with the replies under them), reactions, friendships, friend
//              requests, blocks, notifications to/from them, stories, notes,
//              profile photos, credentials (password, Google link, message keys).
//   kept     : messages already sent (the other person's history), quiz and game
//              attempts, Tic-Tac-Toe games and challenge matches, reports, audit
//              logs. They keep pointing at the account, which becomes an anonymous
//              "Deleted user" tombstone (accountStatus "deleted") so nothing that
//              references it can break; leaderboards leave tombstones out.
async function deleteUserAccount(user) {
  const userId = user._id;

  const posts = await Post.find({ authorId: userId, deletedAt: null }).select("_id");
  for (const post of posts) {
    await softDeletePost({ _id: post._id }, { moderationStatus: "deleted", moderatedAt: new Date() });
  }

  const ownComments = await Comment.find({ authorId: userId }).select("_id parentId");
  const removed = new Set();
  for (const comment of ownComments) {
    if (removed.has(comment._id.toString())) continue;
    const ids = await deleteCommentThread(comment);
    ids.forEach((id) => removed.add(id.toString()));
  }

  const stories = await Story.find({ authorId: userId }).select("media");
  await Promise.all(stories.filter((story) => story.media?.publicId).map((story) => destroyAsset(story.media.publicId, "image")));

  await Promise.all([
    Reaction.deleteMany({ userId }),
    Friendship.deleteMany({ userIds: userId }),
    FriendRequest.deleteMany({ $or: [{ senderId: userId }, { receiverId: userId }] }),
    Block.deleteMany({ $or: [{ blockerId: userId }, { blockedId: userId }] }),
    Notification.deleteMany({ $or: [{ recipientId: userId }, { actorId: userId }] }),
    Story.deleteMany({ authorId: userId }),
    Note.deleteMany({ authorId: userId }),
    user.avatar?.publicId ? destroyAsset(user.avatar.publicId, "image") : null,
    user.cover?.publicId ? destroyAsset(user.cover.publicId, "image") : null,
  ]);

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        fullName: "Deleted user",
        email: `deleted-${userId}@deleted.invalid`,
        bio: "",
        hometown: "",
        currentCity: "",
        dateOfBirth: null,
        role: "user",
        accountStatus: "deleted",
        isMuted: false,
        deletedAt: new Date(),
        publicKey: null,
        publicKeys: [],
      },
      $unset: { passwordHash: "", googleId: "", avatar: "", cover: "" },
    },
  );

  return { posts: posts.length, comments: removed.size };
}

module.exports = {
  softDeletePost,
  collectDescendantIds,
  deleteCommentThread,
  hideContentForBan,
  restoreContentAfterUnban,
  deleteUserAccount,
};
