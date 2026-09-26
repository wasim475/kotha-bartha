const mongoose = require("mongoose");
const User = require("../models/User");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Reaction = require("../models/Reaction");
const Report = require("../models/Report");
const QuizAttempt = require("../models/QuizAttempt");
const GameAttempt = require("../models/GameAttempt");
const TicTacToeGame = require("../models/TicTacToeGame");
const LudoGame = require("../models/LudoGame");
const GameChallengeMatch = require("../models/GameChallengeMatch");
const PageView = require("../models/PageView");
const { GameError } = require("./games/GameError");
const { logAdminAction } = require("./adminAudit.service");
const { hideContentForBan, restoreContentAfterUnban, deleteUserAccount } = require("./contentModeration.service");

// User management for the Admin Panel. Every rule about WHO an admin may act on
// lives here, on the server: the client only ever names a user id and an action.

const PAGE_SIZE = 50; // exactly fifty users per page
const DETAIL_PAGE_SIZE = 20;
const FILTERS = ["all", "admin", "moderator", "user", "banned", "muted"];
const ROLE_CHOICES = ["user", "moderator"]; // roles an admin can assign

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const invalidUser = () => new GameError(404, "NOT_FOUND", "User not found.");
const toPage = (value) => Math.max(1, Math.floor(Number(value)) || 1);

// Nothing here ever selects passwordHash, googleId, message keys or tokens.
const ROW_FIELDS = "fullName email currentCity role accountStatus isMuted createdAt lastSeenAt avatar";

const initialsOf = (name = "") =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function serializeRow(user) {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    currentCity: user.currentCity || "",
    role: user.role || "user", // older accounts predate the role field
    accountStatus: user.accountStatus || "active",
    isMuted: Boolean(user.isMuted),
    createdAt: user.createdAt,
    lastSeenAt: user.lastSeenAt || null,
    avatar: user.avatar?.secureUrl ? { secureUrl: user.avatar.secureUrl } : null,
    initials: initialsOf(user.fullName),
  };
}

// ---- Listing --------------------------------------------------------------

async function listUsers({ page, q, filter }) {
  const query = { accountStatus: { $ne: "deleted" } };
  const term = String(q || "").trim().slice(0, 80);
  if (term) {
    const pattern = new RegExp(escapeRegExp(term), "i");
    query.$or = [{ fullName: pattern }, { email: pattern }];
  }
  const chosen = FILTERS.includes(filter) ? filter : "all";
  if (chosen === "admin" || chosen === "moderator") query.role = chosen;
  if (chosen === "user") query.role = { $in: ["user", null] }; // null also matches accounts with no stored role
  if (chosen === "banned") query.accountStatus = "banned";
  if (chosen === "muted") query.isMuted = true;

  const current = toPage(page);
  const [users, totalUsers] = await Promise.all([
    User.find(query)
      .select(ROW_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .skip((current - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    User.countDocuments(query),
  ]);

  return {
    users: users.map(serializeRow),
    page: current,
    limit: PAGE_SIZE,
    totalUsers,
    totalPages: Math.max(1, Math.ceil(totalUsers / PAGE_SIZE)),
  };
}

// ---- Detail (each tab loads separately) -------------------------------------

async function loadUser(id) {
  if (!mongoose.isValidObjectId(id)) throw new GameError(400, "INVALID_ID", "Invalid user id.");
  const user = await User.findById(id).select(`${ROW_FIELDS} bio hometown dateOfBirth bannedAt bannedBy banReason mutedAt mutedBy muteReason deletedAt`);
  if (!user) throw invalidUser();
  return user;
}

async function getUser(id) {
  const user = await loadUser(id);
  const [posts, comments, replies, reportsAgainst, reportsBy] = await Promise.all([
    Post.countDocuments({ authorId: user._id, deletedAt: null }),
    Comment.countDocuments({ authorId: user._id, parentId: null }),
    Comment.countDocuments({ authorId: user._id, parentId: { $ne: null } }),
    Report.countDocuments({ targetUserId: user._id }),
    Report.countDocuments({ reporterId: user._id }),
  ]);
  return {
    ...serializeRow(user),
    bio: user.bio || "",
    hometown: user.hometown || "",
    dateOfBirth: user.dateOfBirth || null,
    isDeleted: user.accountStatus === "deleted",
    moderation: {
      banned: user.accountStatus === "banned",
      bannedAt: user.bannedAt || null,
      bannedBy: user.bannedBy ? user.bannedBy.toString() : null,
      banReason: user.banReason || "",
      muted: Boolean(user.isMuted),
      mutedAt: user.mutedAt || null,
      mutedBy: user.mutedBy ? user.mutedBy.toString() : null,
      muteReason: user.muteReason || "",
    },
    counts: { posts, comments, replies, reportsAgainst, reportsBy },
  };
}

const contentStatus = (item) =>
  item.deletedAt || item.moderationStatus === "deleted" ? "deleted" : item.moderationStatus === "hidden_by_ban" ? "hidden" : "visible";

async function countsFor(model, ids, targetType, extraField) {
  if (!ids.length) return new Map();
  const rows = await Reaction.aggregate([{ $match: { targetType, targetId: { $in: ids } } }, { $group: { _id: "$targetId", n: { $sum: 1 } } }]);
  void model;
  void extraField;
  return new Map(rows.map((row) => [row._id.toString(), row.n]));
}

async function listUserPosts(id, { page }) {
  const user = await loadUser(id);
  const current = toPage(page);
  const filter = { authorId: user._id };
  const [posts, total] = await Promise.all([
    Post.find(filter).sort({ createdAt: -1 }).skip((current - 1) * DETAIL_PAGE_SIZE).limit(DETAIL_PAGE_SIZE).lean(),
    Post.countDocuments(filter),
  ]);
  const ids = posts.map((post) => post._id);
  const [reactionCounts, commentRows] = await Promise.all([
    countsFor(Post, ids, "post"),
    ids.length ? Comment.aggregate([{ $match: { postId: { $in: ids } } }, { $group: { _id: "$postId", n: { $sum: 1 } } }]) : [],
  ]);
  const commentCounts = new Map(commentRows.map((row) => [row._id.toString(), row.n]));
  return {
    items: posts.map((post) => ({
      id: post._id.toString(),
      body: (post.body || "").slice(0, 300),
      media: (post.media || []).slice(0, 3).map((item) => ({ secureUrl: item.secureUrl })),
      mediaCount: (post.media || []).length,
      createdAt: post.createdAt,
      status: contentStatus(post),
      comments: commentCounts.get(post._id.toString()) || 0,
      reactions: reactionCounts.get(post._id.toString()) || 0,
    })),
    page: current,
    total,
    totalPages: Math.max(1, Math.ceil(total / DETAIL_PAGE_SIZE)),
  };
}

// type: "comment" (top level) | "reply"
async function listUserComments(id, { page, type }) {
  const user = await loadUser(id);
  const current = toPage(page);
  const filter = { authorId: user._id, parentId: type === "reply" ? { $ne: null } : null };
  const [comments, total] = await Promise.all([
    Comment.find(filter).sort({ createdAt: -1 }).skip((current - 1) * DETAIL_PAGE_SIZE).limit(DETAIL_PAGE_SIZE).lean(),
    Comment.countDocuments(filter),
  ]);
  return {
    items: comments.map((comment) => ({
      id: comment._id.toString(),
      postId: comment.postId.toString(),
      parentId: comment.parentId ? comment.parentId.toString() : null,
      body: (comment.body || "").slice(0, 300),
      createdAt: comment.createdAt,
      status: contentStatus(comment),
    })),
    page: current,
    total,
    totalPages: Math.max(1, Math.ceil(total / DETAIL_PAGE_SIZE)),
  };
}

// Quiz, game and leaderboard numbers for one user (all-time, straight from the
// stored attempts — the same sources the Leaderboard itself adds up).
async function getUserActivity(id) {
  const user = await loadUser(id);
  const userId = user._id;
  // Page time over the last 30 days: per page, and the most recent visits. Only the
  // page name, start and active time — never anything the person did on the page.
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const [quiz, games, ttt, challenges, ludo, pageTotals, recentViews] = await Promise.all([
    QuizAttempt.aggregate([
      { $match: { userId, status: "completed" } },
      { $group: { _id: null, attempts: { $sum: 1 }, points: { $sum: { $cond: ["$isFirstAttempt", "$score", 0] } }, lastAt: { $max: "$completedAt" } } },
    ]),
    GameAttempt.aggregate([
      { $match: { userId, status: "completed" } },
      { $group: { _id: null, attempts: { $sum: 1 }, points: { $sum: "$score" }, lastAt: { $max: "$completedAt" } } },
    ]),
    TicTacToeGame.aggregate([
      { $match: { status: { $in: ["won", "draw"] }, $or: [{ playerX: userId }, { playerO: userId }] } },
      { $group: { _id: null, played: { $sum: 1 }, wins: { $sum: { $cond: [{ $eq: ["$winnerId", userId] }, 1, 0] } }, points: { $sum: { $cond: [{ $eq: ["$winnerId", userId] }, "$rewardPoints", 0] } } } },
    ]),
    GameChallengeMatch.aggregate([
      { $match: { status: "completed", playerIds: userId } },
      { $group: { _id: null, played: { $sum: 1 }, wins: { $sum: { $cond: [{ $eq: ["$winnerId", userId] }, 1, 0] } }, points: { $sum: { $cond: [{ $eq: ["$winnerId", userId] }, "$rewardPoints", 0] } } } },
    ]),
    LudoGame.aggregate([
      { $match: { status: "finished", participantIds: userId } },
      { $unwind: "$rankings" },
      { $match: { "rankings.userId": userId } },
      { $group: { _id: null, played: { $sum: 1 }, wins: { $sum: { $cond: [{ $eq: ["$rankings.rank", 1] }, 1, 0] } }, points: { $sum: "$rankings.rewardPoints" } } },
    ]),
    PageView.aggregate([
      { $match: { userId, createdAt: { $gte: since } } },
      { $group: { _id: "$page", visits: { $sum: 1 }, totalSeconds: { $sum: { $ifNull: ["$durationSeconds", 0] } }, lastAt: { $max: "$createdAt" } } },
      { $project: { _id: 0, page: "$_id", visits: 1, totalSeconds: 1, lastAt: 1 } },
      { $sort: { totalSeconds: -1, visits: -1 } },
      { $limit: 20 },
    ]),
    PageView.find({ userId, createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(15).select("page createdAt durationSeconds").lean(),
  ]);
  const q = quiz[0] || {};
  const g = games[0] || {};
  const t = ttt[0] || {};
  const c = challenges[0] || {};
  const l = ludo[0] || {};
  const quizPoints = q.points || 0;
  const gamePoints = (g.points || 0) + (t.points || 0) + (c.points || 0) + (l.points || 0);
  return {
    quiz: { attempts: q.attempts || 0, points: quizPoints, lastAt: q.lastAt || null },
    games: {
      attempts: g.attempts || 0,
      points: g.points || 0,
      lastAt: g.lastAt || null,
      ticTacToe: { played: t.played || 0, wins: t.wins || 0, points: t.points || 0 },
      challenges: { played: c.played || 0, wins: c.wins || 0, points: c.points || 0 },
      ludo: { played: l.played || 0, wins: l.wins || 0, points: l.points || 0 },
    },
    leaderboard: { quizPoints, gamePoints, totalPoints: quizPoints + gamePoints, ranked: user.role === "user" && user.accountStatus === "active" },
    pageTime: {
      days: 30,
      pages: pageTotals,
      recent: recentViews.map((view) => ({ page: view.page, startedAt: view.createdAt, durationSeconds: typeof view.durationSeconds === "number" ? view.durationSeconds : null })),
    },
  };
}

// ---- Moderation actions -----------------------------------------------------

// Loads the account an action is aimed at and applies the rules every action shares:
// never yourself, and never another administrator.
async function loadActionTarget(admin, id, { allowAdmin = false } = {}) {
  const target = await loadUser(id);
  if (target.accountStatus === "deleted") throw new GameError(409, "ACCOUNT_DELETED", "This account has been deleted.");
  if (target._id.equals(admin._id)) throw new GameError(400, "SELF_ACTION", "You can't do this to your own account.");
  if (target.role === "admin" && !allowAdmin) throw new GameError(403, "ADMIN_PROTECTED", "Administrator accounts can't be changed here.");
  return target;
}

const cleanReason = (value) => String(value || "").trim().slice(0, 300);

async function setRole(admin, id, role) {
  if (admin.role !== "admin") throw new GameError(403, "FORBIDDEN", "Only an administrator can change roles.");
  if (!ROLE_CHOICES.includes(role)) throw new GameError(400, "VALIDATION_ERROR", "Choose Moderator or User.");
  const target = await loadActionTarget(admin, id);
  if (target.role === role) return getUser(id);

  const previous = target.role;
  // Conditional on the role we just read, so two admins racing can't both apply.
  const updated = await User.findOneAndUpdate({ _id: target._id, role: previous }, { $set: { role } }, { new: true });
  if (!updated) throw new GameError(409, "CONFLICT", "This account changed while you were editing it. Try again.");
  await logAdminAction(admin, { action: "user.role_changed", targetType: "user", targetId: target._id, targetUserId: target._id, metadata: { from: previous, to: role } });
  return getUser(id);
}

async function setBan(admin, id, banned, reason) {
  const target = await loadActionTarget(admin, id);
  const isBanned = target.accountStatus === "banned";
  if (Boolean(banned) === isBanned) return { user: await getUser(id), changed: false };

  if (banned) {
    await User.updateOne(
      { _id: target._id },
      { $set: { accountStatus: "banned", bannedAt: new Date(), bannedBy: admin._id, banReason: cleanReason(reason) } },
    );
    const hidden = await hideContentForBan(target._id, admin);
    await logAdminAction(admin, { action: "user.banned", targetType: "user", targetId: target._id, targetUserId: target._id, metadata: { reason: cleanReason(reason), hidden } });
  } else {
    await User.updateOne(
      { _id: target._id },
      { $set: { accountStatus: "active" }, $unset: { bannedAt: "", bannedBy: "", banReason: "" } },
    );
    const restored = await restoreContentAfterUnban(target._id);
    await logAdminAction(admin, { action: "user.unbanned", targetType: "user", targetId: target._id, targetUserId: target._id, metadata: { restored } });
  }
  return { user: await getUser(id), changed: true };
}

async function setMute(admin, id, muted, reason) {
  const target = await loadActionTarget(admin, id);
  if (Boolean(muted) === Boolean(target.isMuted)) return { user: await getUser(id), changed: false };

  if (muted) {
    await User.updateOne({ _id: target._id }, { $set: { isMuted: true, mutedAt: new Date(), mutedBy: admin._id, muteReason: cleanReason(reason) } });
    await logAdminAction(admin, { action: "user.muted", targetType: "user", targetId: target._id, targetUserId: target._id, metadata: { reason: cleanReason(reason) } });
  } else {
    await User.updateOne({ _id: target._id }, { $set: { isMuted: false }, $unset: { mutedAt: "", mutedBy: "", muteReason: "" } });
    await logAdminAction(admin, { action: "user.unmuted", targetType: "user", targetId: target._id, targetUserId: target._id, metadata: {} });
  }
  return { user: await getUser(id), changed: true };
}

// Permanent. The caller must send { confirm: true }; the delete is refused for
// yourself and for any administrator, so the last admin can never be removed.
async function deleteUser(admin, id, { confirm } = {}) {
  if (confirm !== true) throw new GameError(400, "CONFIRMATION_REQUIRED", "Confirm the permanent deletion first.");
  const target = await loadActionTarget(admin, id);
  const full = await User.findById(target._id);
  const summary = { name: full.fullName, role: full.role };
  const removed = await deleteUserAccount(full);
  await logAdminAction(admin, { action: "user.deleted", targetType: "user", targetId: target._id, targetUserId: target._id, metadata: { ...summary, removed } });
  return { id: target._id.toString(), deleted: true, removed };
}

module.exports = {
  PAGE_SIZE,
  FILTERS,
  listUsers,
  getUser,
  listUserPosts,
  listUserComments,
  getUserActivity,
  setRole,
  setBan,
  setMute,
  deleteUser,
  serializeRow,
  contentStatus,
};
