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
    dateOfBirth: user.dateOfBirth,
    hometown: user.hometown,
    currentCity: user.currentCity,
    avatar: user.avatar,
    cover: user.cover,
    initials: initials(user.fullName),
    lastSeenAt: user.lastSeenAt,
    createdAt: user.createdAt,
  };
}

async function serializePost(post, viewerId) {
  const reactionDocs = await Reaction.find({
    targetType: "post",
    targetId: post._id,
  })
    .select("userId type")
    .lean();

  const mine = reactionDocs.find(
    (reaction) => reaction.userId.toString() === viewerId.toString(),
  );

  return {
    id: post._id.toString(),
    body: post.body,
    media: post.media,
    createdAt: post.createdAt,
    author: safeUser(post.authorId),
    editable: post.authorId._id.toString() === viewerId.toString(),
    // reaction/reactions mirror serializeComment's shape so the client can
    // use the same ReactionButton/ReactionSummary for both. likes/liked
    // are kept for any existing consumer of the old boolean-like shape.
    reaction: mine?.type || null,
    reactions: reactionDocs.reduce(
      (counts, entry) => ({
        ...counts,
        [entry.type]: (counts[entry.type] || 0) + 1,
      }),
      {},
    ),
    likes: reactionDocs.length,
    liked: Boolean(mine),
    comments: await Comment.countDocuments({
      postId: post._id,
    }),
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

function serializeStory(story) {
  const authorId = story.authorId?._id || story.authorId;
  return {
    id: story._id.toString(),
    authorId: authorId.toString(),
    type: story.type,
    text: story.text || "",
    textColor: story.textColor,
    backgroundColor: story.type === "text" ? story.backgroundColor : null,
    media: story.type === "image" ? story.media : null,
    createdAt: story.createdAt,
    expiresAt: story.expiresAt,
  };
}

function serializeNote(note) {
  const authorId = note.authorId?._id || note.authorId;
  return {
    id: note._id.toString(),
    authorId: authorId.toString(),
    text: note.text,
    createdAt: note.createdAt,
    expiresAt: note.expiresAt,
  };
}

module.exports = {
  initials,
  safeUser,
  serializePost,
  serializeComment,
  serializeStory,
  serializeNote,
};
