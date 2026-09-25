const mongoose = require("mongoose");
const User = require("../models/User");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Reaction = require("../models/Reaction");
const { GameError } = require("./games/GameError");
const { logAdminAction } = require("./adminAudit.service");
const { softDeletePost, deleteCommentThread } = require("./contentModeration.service");

// Post / comment / reply moderation for the Admin Panel. Deleting goes through the
// SAME cascades the authors' own delete buttons use (contentModeration.service.js).

const PAGE_SIZE = 20;
const STATUSES = ["all", "visible", "hidden", "deleted"];
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toPage = (value) => Math.max(1, Math.floor(Number(value)) || 1);
const notFound = (what = "Content") => new GameError(404, "NOT_FOUND", `${what} not found.`);

const statusOf = (item) =>
  item.deletedAt || item.moderationStatus === "deleted" ? "deleted" : item.moderationStatus === "hidden_by_ban" ? "hidden" : "visible";

const authorView = (user) =>
  user
    ? {
        id: user._id.toString(),
        fullName: user.fullName,
        avatar: user.avatar?.secureUrl ? { secureUrl: user.avatar.secureUrl } : null,
        accountStatus: user.accountStatus || "active",
      }
    : { id: null, fullName: "Unknown user", avatar: null, accountStatus: "deleted" };

function serializePost(post, author, counts = {}) {
  return {
    id: post._id.toString(),
    author: authorView(author),
    body: post.body || "",
    preview: (post.body || "").slice(0, 200),
    media: (post.media || []).slice(0, 4).map((item) => ({ secureUrl: item.secureUrl })),
    mediaCount: (post.media || []).length,
    createdAt: post.createdAt,
    status: statusOf(post),
    comments: counts.comments || 0,
    reactions: counts.reactions || 0,
  };
}

async function countsForPosts(ids) {
  if (!ids.length) return { comments: new Map(), reactions: new Map() };
  const [commentRows, reactionRows] = await Promise.all([
    Comment.aggregate([{ $match: { postId: { $in: ids } } }, { $group: { _id: "$postId", n: { $sum: 1 } } }]),
    Reaction.aggregate([{ $match: { targetType: "post", targetId: { $in: ids } } }, { $group: { _id: "$targetId", n: { $sum: 1 } } }]),
  ]);
  return {
    comments: new Map(commentRows.map((row) => [row._id.toString(), row.n])),
    reactions: new Map(reactionRows.map((row) => [row._id.toString(), row.n])),
  };
}

// Query: page, q (post text), userId, status (all|visible|hidden|deleted), from, to.
async function listPosts({ page, q, userId, status, from, to }) {
  const filter = {};
  const term = String(q || "").trim().slice(0, 80);
  if (term) filter.body = { $regex: escapeRegExp(term), $options: "i" };
  if (userId) {
    if (!mongoose.isValidObjectId(userId)) throw new GameError(400, "INVALID_ID", "Invalid user id.");
    filter.authorId = userId;
  }
  const chosen = STATUSES.includes(status) ? status : "all";
  if (chosen === "visible") Object.assign(filter, { deletedAt: null, moderationStatus: { $nin: ["hidden_by_ban", "deleted"] } });
  if (chosen === "hidden") Object.assign(filter, { deletedAt: null, moderationStatus: "hidden_by_ban" });
  if (chosen === "deleted") filter.$or = [{ deletedAt: { $ne: null } }, { moderationStatus: "deleted" }];
  const created = {};
  if (from && !Number.isNaN(Date.parse(from))) created.$gte = new Date(from);
  if (to && !Number.isNaN(Date.parse(to))) created.$lte = new Date(new Date(to).getTime() + 24 * 3600 * 1000 - 1);
  if (Object.keys(created).length) filter.createdAt = created;

  const current = toPage(page);
  const [posts, total] = await Promise.all([
    Post.find(filter).sort({ createdAt: -1, _id: -1 }).skip((current - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Post.countDocuments(filter),
  ]);
  const authors = await User.find({ _id: { $in: [...new Set(posts.map((post) => post.authorId.toString()))] } })
    .select("fullName avatar accountStatus")
    .lean();
  const authorById = new Map(authors.map((author) => [author._id.toString(), author]));
  const counts = await countsForPosts(posts.map((post) => post._id));

  return {
    items: posts.map((post) =>
      serializePost(post, authorById.get(post.authorId.toString()), {
        comments: counts.comments.get(post._id.toString()),
        reactions: counts.reactions.get(post._id.toString()),
      }),
    ),
    page: current,
    limit: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

// A post with its whole thread, whatever state it is in (hidden and deleted content
// is exactly what an admin needs to be able to read). `highlight` marks the
// comment/reply a report points at.
async function getPostContext(postId, { highlight = [] } = {}) {
  if (!mongoose.isValidObjectId(postId)) throw new GameError(400, "INVALID_ID", "Invalid post id.");
  const post = await Post.findById(postId).lean();
  if (!post) throw notFound("Post");
  const comments = await Comment.find({ postId: post._id }).sort({ createdAt: 1 }).limit(300).lean();
  const users = await User.find({ _id: { $in: [...new Set([post.authorId, ...comments.map((comment) => comment.authorId)].map(String))] } })
    .select("fullName avatar accountStatus")
    .lean();
  const userById = new Map(users.map((user) => [user._id.toString(), user]));
  const marked = new Set(highlight.filter(Boolean).map(String));
  const counts = await countsForPosts([post._id]);

  return {
    post: serializePost(post, userById.get(post.authorId.toString()), {
      comments: counts.comments.get(post._id.toString()),
      reactions: counts.reactions.get(post._id.toString()),
    }),
    comments: comments.map((comment) => ({
      id: comment._id.toString(),
      parentId: comment.parentId ? comment.parentId.toString() : null,
      author: authorView(userById.get(comment.authorId.toString())),
      body: comment.body,
      createdAt: comment.createdAt,
      status: statusOf(comment),
      highlighted: marked.has(comment._id.toString()),
    })),
  };
}

// Deletes (soft, reversible only by database access) one post. Returns null if it
// was already gone.
async function deletePost(admin, postId, { via = "admin_panel", reportId = null } = {}) {
  if (!mongoose.isValidObjectId(postId)) throw new GameError(400, "INVALID_ID", "Invalid post id.");
  const post = await softDeletePost({ _id: postId }, { moderationStatus: "deleted", moderatedBy: admin._id, moderatedAt: new Date() });
  if (!post) throw notFound("Post");
  await logAdminAction(admin, {
    action: "post.deleted",
    targetType: "post",
    targetId: post._id,
    targetUserId: post.authorId,
    metadata: { via, reportId, preview: (post.body || "").slice(0, 120) },
  });
  return { id: post._id.toString(), deleted: true, authorId: post.authorId.toString() };
}

// A comment or a reply (a reply is a comment with a parent). Everything replying
// to it goes too — the same rule as the author's own delete.
async function deleteComment(admin, commentId, { via = "admin_panel", reportId = null } = {}) {
  if (!mongoose.isValidObjectId(commentId)) throw new GameError(400, "INVALID_ID", "Invalid comment id.");
  const comment = await Comment.findById(commentId).select("authorId parentId postId body");
  if (!comment) throw notFound("Comment");
  const isReply = Boolean(comment.parentId);
  const ids = await deleteCommentThread(comment);
  await logAdminAction(admin, {
    action: isReply ? "reply.deleted" : "comment.deleted",
    targetType: isReply ? "reply" : "comment",
    targetId: comment._id,
    targetUserId: comment.authorId,
    metadata: { via, reportId, postId: comment.postId.toString(), removed: ids.length, preview: (comment.body || "").slice(0, 120) },
  });
  return { id: comment._id.toString(), deleted: true, deletedIds: ids.map(String), authorId: comment.authorId.toString() };
}

module.exports = { listPosts, getPostContext, deletePost, deleteComment, statusOf };
