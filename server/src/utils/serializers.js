const Comment = require("../models/Comment");
const Reaction = require("../models/Reaction");

function initials(name = "") {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function safeUser(user) {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    bio: user.bio,
    avatar: user.avatar,
    cover: user.cover,
    initials: initials(user.fullName),
    lastSeenAt: user.lastSeenAt,
  };
}

async function serializePost(post, viewerId) {
  const reactions = await Reaction.find({
    targetType: "post",
    targetId: post._id,
  })
    .select("userId")
    .lean();

  return {
    id: post._id.toString(),
    body: post.body,
    media: post.media,
    createdAt: post.createdAt,
    author: safeUser(post.authorId),
    editable: post.authorId._id.toString() === viewerId.toString(),
    likes: reactions.length,
    comments: await Comment.countDocuments({
      postId: post._id,
    }),
    liked: reactions.some(
      (reaction) => reaction.userId.toString() === viewerId.toString(),
    ),
  };
}

async function serializeComment(comment, viewerId) {
  const reactions = await Reaction.find({
    targetType: "comment",
    targetId: comment._id,
  })
    .select("userId type")
    .lean();

  return {
    id: comment._id.toString(),
    parentId: comment.parentId ? comment.parentId.toString() : null,
    body: comment.body,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: safeUser(comment.authorId),
    editable: comment.authorId._id.toString() === viewerId.toString(),
    reaction:
      reactions.find((entry) => entry.userId.toString() === viewerId.toString())
        ?.type || null,
    reactions: reactions.reduce(
      (counts, entry) => ({
        ...counts,
        [entry.type]: (counts[entry.type] || 0) + 1,
      }),
      {},
    ),
  };
}

module.exports = { initials, safeUser, serializePost, serializeComment };
