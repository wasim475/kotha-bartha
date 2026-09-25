const mongoose = require("mongoose");
const User = require("../models/User");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Report = require("../models/Report");
const { REPORT_REASONS, REPORT_TARGETS, REPORT_STATUSES } = Report;
const { GameError } = require("./games/GameError");
const { VISIBLE_CONTENT } = require("../utils/moderation");
const { logAdminAction } = require("./adminAudit.service");
const { getPostContext, deletePost, deleteComment } = require("./adminContent.service");
const { setBan, setMute } = require("./adminUsers.service");

// One reporting pipeline for users, posts, comments and replies. The reporter only
// names a target and a reason; who wrote it, which post it lives in and what it
// said are all read from the database here.

const PAGE_SIZE = 20;
const toPage = (value) => Math.max(1, Math.floor(Number(value)) || 1);
const OPEN = ["pending", "reviewing"];

// ---- Filing a report (any signed-in user) ------------------------------------

async function topLevelCommentId(comment) {
  let current = comment;
  while (current.parentId) {
    const parent = await Comment.findById(current.parentId).select("_id parentId").lean();
    if (!parent) break;
    current = parent;
  }
  return current._id;
}

// Resolves the reported thing and returns everything the report stores about it.
async function resolveTarget(reporter, targetType, targetId) {
  if (!mongoose.isValidObjectId(targetId)) throw new GameError(400, "INVALID_TARGET", "That can't be reported.");

  if (targetType === "user") {
    const user = await User.findById(targetId).select("fullName accountStatus");
    if (!user || user.accountStatus === "deleted") throw new GameError(404, "NOT_FOUND", "User not found.");
    return { targetType, targetId: user._id, targetUserId: user._id, snapshot: { text: "", authorName: user.fullName } };
  }

  if (targetType === "post") {
    const post = await Post.findOne({ _id: targetId, deletedAt: null, ...VISIBLE_CONTENT }).select("authorId body");
    if (!post) throw new GameError(404, "NOT_FOUND", "Post not found.");
    const author = await User.findById(post.authorId).select("fullName");
    return {
      targetType,
      targetId: post._id,
      targetUserId: post.authorId,
      postId: post._id,
      snapshot: { text: (post.body || "").slice(0, 300), authorName: author?.fullName || "" },
    };
  }

  // A reply is a comment with a parent: the stored document decides which it is.
  const comment = await Comment.findOne({ _id: targetId, ...VISIBLE_CONTENT }).select("authorId body postId parentId");
  if (!comment) throw new GameError(404, "NOT_FOUND", "Comment not found.");
  const author = await User.findById(comment.authorId).select("fullName");
  return {
    targetType: comment.parentId ? "reply" : "comment",
    targetId: comment._id,
    targetUserId: comment.authorId,
    postId: comment.postId,
    threadId: await topLevelCommentId(comment),
    snapshot: { text: (comment.body || "").slice(0, 300), authorName: author?.fullName || "" },
  };
}

async function createReport(reporter, body = {}) {
  const { targetType, targetId, reason } = body;
  if (!REPORT_TARGETS.includes(targetType)) throw new GameError(400, "INVALID_TARGET", "That can't be reported.");
  if (!REPORT_REASONS.includes(reason)) throw new GameError(400, "INVALID_REASON", "Choose a reason for the report.");
  const description = String(body.description || "").trim().slice(0, 1000);
  if (reason === "other" && description.length < 3) {
    throw new GameError(400, "DESCRIPTION_REQUIRED", "Tell us a little about the problem.");
  }

  const target = await resolveTarget(reporter, targetType, targetId);
  if (target.targetUserId.equals(reporter._id)) throw new GameError(400, "SELF_REPORT", "You can't report yourself.");

  try {
    const report = await Report.create({ ...target, reporterId: reporter._id, reason, description });
    return { id: report._id.toString(), status: report.status, duplicate: false };
  } catch (error) {
    if (error?.code !== 11000) throw error;
    // Already reported by this person and still open: same answer, no second copy.
    const existing = await Report.findOne({ reporterId: reporter._id, targetType: target.targetType, targetId: target.targetId, status: { $in: OPEN } }).lean();
    return { id: existing?._id.toString() || null, status: existing?.status || "pending", duplicate: true };
  }
}

// ---- The inbox (staff) ----------------------------------------------------

const userView = (user) =>
  user ? { id: user._id.toString(), fullName: user.fullName, avatar: user.avatar?.secureUrl ? { secureUrl: user.avatar.secureUrl } : null } : null;

async function usersMap(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  const users = await User.find({ _id: { $in: unique } }).select("fullName avatar").lean();
  return new Map(users.map((user) => [user._id.toString(), user]));
}

function serializeReport(report, users) {
  return {
    id: report._id.toString(),
    targetType: report.targetType,
    targetId: report.targetId.toString(),
    reason: report.reason,
    description: report.description || "",
    status: report.status,
    createdAt: report.createdAt,
    resolvedAt: report.resolvedAt || null,
    resolutionAction: report.resolutionAction || null,
    resolutionNote: report.resolutionNote || "",
    reporter: userView(users.get(report.reporterId?.toString())),
    reportedUser: userView(users.get(report.targetUserId?.toString())),
    resolvedBy: userView(users.get(report.resolvedBy?.toString())),
    snapshot: report.snapshot || { text: "", authorName: "" },
    postId: report.postId ? report.postId.toString() : null,
    threadId: report.threadId ? report.threadId.toString() : null,
  };
}

async function listReports({ status, targetType, page }) {
  const filter = {};
  if (REPORT_STATUSES.includes(status)) filter.status = status;
  if (REPORT_TARGETS.includes(targetType)) filter.targetType = targetType;
  const current = toPage(page);

  const [reports, total, statusRows] = await Promise.all([
    Report.find(filter).sort({ createdAt: -1, _id: -1 }).skip((current - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Report.countDocuments(filter),
    Report.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const users = await usersMap(reports.flatMap((report) => [report.reporterId, report.targetUserId]));
  const counts = Object.fromEntries(REPORT_STATUSES.map((name) => [name, 0]));
  statusRows.forEach((row) => {
    counts[row._id] = row.n;
  });

  return {
    items: reports.map((report) => serializeReport(report, users)),
    page: current,
    limit: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    counts,
  };
}

// The report plus enough context for an admin to understand it without leaving the
// Admin Panel, and the links that open the exact place in the app.
async function getReport(id) {
  if (!mongoose.isValidObjectId(id)) throw new GameError(400, "INVALID_ID", "Invalid report id.");
  const report = await Report.findById(id).lean();
  if (!report) throw new GameError(404, "NOT_FOUND", "Report not found.");
  const users = await usersMap([report.reporterId, report.targetUserId, report.resolvedBy]);
  const base = serializeReport(report, users);

  let context = null;
  let links = {};
  if (report.targetType === "user") {
    links = { admin: `/admin/users/${report.targetId}`, app: `/app/profile/${report.targetId}` };
  } else if (report.postId) {
    const params = new URLSearchParams();
    if (report.targetType === "comment") params.set("commentId", report.targetId.toString());
    if (report.targetType === "reply") {
      if (report.threadId) params.set("commentId", report.threadId.toString());
      params.set("replyId", report.targetId.toString());
    }
    const query = params.toString();
    links = { admin: `/admin/reports/${report._id}`, app: `/app/post/${report.postId}${query ? `?${query}` : ""}` };
    try {
      context = await getPostContext(report.postId, { highlight: [report.targetId] });
    } catch {
      context = null;
    }
  }

  // Is what was reported still there?
  let targetState = "present";
  if (report.targetType === "post") targetState = context ? context.post.status : "deleted";
  if (report.targetType === "comment" || report.targetType === "reply") {
    const found = context?.comments.find((comment) => comment.id === report.targetId.toString());
    targetState = found ? found.status : "deleted";
  }
  if (report.targetType === "user") {
    const target = await User.findById(report.targetId).select("accountStatus isMuted").lean();
    targetState = !target || target.accountStatus === "deleted" ? "deleted" : target.accountStatus === "banned" ? "banned" : target.isMuted ? "muted" : "active";
  }

  return { ...base, context, links, targetState };
}

// action: reviewing | dismiss | resolve | delete_content | ban_user | mute_user
async function updateReport(admin, id, { action, note } = {}) {
  if (!mongoose.isValidObjectId(id)) throw new GameError(400, "INVALID_ID", "Invalid report id.");
  const report = await Report.findById(id);
  if (!report) throw new GameError(404, "NOT_FOUND", "Report not found.");
  if (!OPEN.includes(report.status)) throw new GameError(409, "REPORT_CLOSED", "This report has already been closed.");
  const cleanNote = String(note || "").trim().slice(0, 500);

  if (action === "reviewing") {
    if (report.status === "reviewing") return getReport(id);
    await Report.updateOne({ _id: report._id, status: "pending" }, { $set: { status: "reviewing" } });
    await logAdminAction(admin, { action: "report.reviewing", targetType: "report", targetId: report._id, targetUserId: report.targetUserId, metadata: { targetType: report.targetType } });
    return getReport(id);
  }

  let status = "resolved";
  let resolutionAction = "resolved";
  const detail = { targetType: report.targetType, targetId: report.targetId.toString(), reason: report.reason };

  if (action === "dismiss") {
    status = "dismissed";
    resolutionAction = "dismissed";
  } else if (action === "resolve") {
    resolutionAction = "resolved";
  } else if (action === "delete_content") {
    if (report.targetType === "user") throw new GameError(400, "VALIDATION_ERROR", "A user report has no content to delete.");
    try {
      if (report.targetType === "post") await deletePost(admin, report.targetId, { via: "report", reportId: report._id.toString() });
      else await deleteComment(admin, report.targetId, { via: "report", reportId: report._id.toString() });
    } catch (error) {
      if (error.code !== "NOT_FOUND") throw error; // already gone: the report can still be closed
    }
    resolutionAction = "content_deleted";
  } else if (action === "ban_user") {
    await setBan(admin, report.targetUserId, true, `Report: ${report.reason}`);
    resolutionAction = "user_banned";
  } else if (action === "mute_user") {
    await setMute(admin, report.targetUserId, true, `Report: ${report.reason}`);
    resolutionAction = "user_muted";
  } else {
    throw new GameError(400, "VALIDATION_ERROR", "Choose an action.");
  }

  const closed = await Report.findOneAndUpdate(
    { _id: report._id, status: { $in: OPEN } },
    { $set: { status, resolvedAt: new Date(), resolvedBy: admin._id, resolutionAction, resolutionNote: cleanNote } },
    { new: true },
  );
  if (!closed) throw new GameError(409, "REPORT_CLOSED", "This report has already been closed.");
  await logAdminAction(admin, {
    action: status === "dismissed" ? "report.dismissed" : "report.resolved",
    targetType: "report",
    targetId: report._id,
    targetUserId: report.targetUserId,
    metadata: { ...detail, resolutionAction, note: cleanNote },
  });
  return getReport(id);
}

// Reports involving one user (for the user detail page): about them, or by them.
async function listReportsForUser(userId, { direction, page }) {
  if (!mongoose.isValidObjectId(userId)) throw new GameError(400, "INVALID_ID", "Invalid user id.");
  const filter = direction === "by" ? { reporterId: userId } : { targetUserId: userId };
  const current = toPage(page);
  const [reports, total] = await Promise.all([
    Report.find(filter).sort({ createdAt: -1 }).skip((current - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Report.countDocuments(filter),
  ]);
  const users = await usersMap(reports.flatMap((report) => [report.reporterId, report.targetUserId]));
  return { items: reports.map((report) => serializeReport(report, users)), page: current, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

module.exports = { createReport, listReports, getReport, updateReport, listReportsForUser, serializeReport };
