const mongoose = require("mongoose");
const User = require("../models/User");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Report = require("../models/Report");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const SupportMessage = require("../models/SupportMessage");
const { GameError } = require("./games/GameError");
const { pairKey } = require("../utils/ids");
const { UNSEND_WINDOW_MS } = require("../utils/config");
const { logAdminAction } = require("./adminAudit.service");
const { serializeReport } = require("./report.service");

// Messaging between users and administrators, built on what already exists:
//   admin -> user : an ordinary Message in the normal 1-to-1 conversation (flagged
//                   adminMessage), delivered over the same "message:new" socket
//                   event, so it shows up in the user's regular Inbox.
//   user -> admin : a SupportMessage (a complaint, question or appeal, optionally
//                   tied to a report or a user / post / comment). Admins read them
//                   in the Admin inbox and answer with the path above.

const PAGE_SIZE = 20;
const TABS = ["all", "unread", "reports", "user", "system"];
const HOURLY_LIMIT = 5;
const toPage = (value) => Math.max(1, Math.floor(Number(value)) || 1);
const userView = (user) =>
  user ? { id: user._id.toString(), fullName: user.fullName, avatar: user.avatar?.secureUrl ? { secureUrl: user.avatar.secureUrl } : null } : null;

// ---- User -> admin -----------------------------------------------------------

async function createSupportMessage(user, body = {}) {
  const text = String(body.body || "").trim();
  if (text.length < 3) throw new GameError(400, "VALIDATION_ERROR", "Write a message first.");
  if (text.length > 2000) throw new GameError(400, "VALIDATION_ERROR", "That message is too long.");
  const subject = String(body.subject || "").trim().slice(0, 120);
  const category = ["user", "post", "comment", "reply", "general"].includes(body.category) ? body.category : "general";

  // Keep the channel usable: a handful of messages per hour per person.
  const recent = await SupportMessage.countDocuments({ fromUserId: user._id, createdAt: { $gte: new Date(Date.now() - 3600 * 1000) } });
  if (recent >= HOURLY_LIMIT) throw new GameError(429, "RATE_LIMITED", "You've sent several messages recently. Please wait a while.");

  // Optional context is verified, never trusted: a report must be the sender's own,
  // and a target must exist.
  let reportId = null;
  if (body.reportId) {
    if (!mongoose.isValidObjectId(body.reportId)) throw new GameError(400, "INVALID_REPORT", "That report can't be linked.");
    const report = await Report.findOne({ _id: body.reportId, reporterId: user._id }).select("_id");
    if (!report) throw new GameError(404, "NOT_FOUND", "Report not found.");
    reportId = report._id;
  }
  let targetType = null;
  let targetId = null;
  if (body.targetType && body.targetId) {
    if (!mongoose.isValidObjectId(body.targetId)) throw new GameError(400, "INVALID_TARGET", "That can't be linked.");
    const exists =
      body.targetType === "user"
        ? await User.exists({ _id: body.targetId })
        : body.targetType === "post"
          ? await Post.exists({ _id: body.targetId })
          : body.targetType === "comment" || body.targetType === "reply"
            ? await Comment.exists({ _id: body.targetId })
            : null;
    if (!exists) throw new GameError(404, "NOT_FOUND", "That item no longer exists.");
    targetType = body.targetType;
    targetId = body.targetId;
  }

  const message = await SupportMessage.create({ fromUserId: user._id, category, subject, body: text, reportId, targetType, targetId });
  return { id: message._id.toString(), sent: true };
}

// ---- Admin -> user -----------------------------------------------------------

async function sendAdminMessage(admin, req, { userId, body, reportId } = {}) {
  if (!mongoose.isValidObjectId(userId)) throw new GameError(400, "INVALID_USER", "Choose a user to message.");
  const text = String(body || "").trim();
  if (!text) throw new GameError(400, "VALIDATION_ERROR", "Write a message first.");
  if (text.length > 2000) throw new GameError(400, "VALIDATION_ERROR", "That message is too long.");
  if (admin._id.equals(userId)) throw new GameError(400, "INVALID_USER", "Choose another user to message.");

  const target = await User.findById(userId).select("fullName accountStatus");
  if (!target || target.accountStatus === "deleted") throw new GameError(404, "NOT_FOUND", "User not found.");
  if (reportId && !mongoose.isValidObjectId(reportId)) throw new GameError(400, "INVALID_REPORT", "That report can't be linked.");

  // The normal one-to-one conversation between the two accounts (created if needed).
  const key = pairKey(admin._id, target._id);
  const conversation = await Conversation.findOneAndUpdate(
    { pairKey: key },
    { $setOnInsert: { participantIds: [admin._id, target._id], pairKey: key } },
    { new: true, upsert: true },
  );
  conversation.hiddenFor = (conversation.hiddenFor || []).filter((id) => ![admin._id.toString(), target._id.toString()].includes(id.toString()));

  const message = await Message.create({
    conversationId: conversation._id,
    senderId: admin._id,
    recipientId: target._id,
    body: text,
    status: "delivered",
    adminMessage: true,
  });
  conversation.lastMessage = text;
  conversation.lastMessageAt = message.createdAt;
  conversation.lastMessageId = message._id;
  conversation.unreadCounts.set(target._id.toString(), (conversation.unreadCounts.get(target._id.toString()) || 0) + 1);
  await conversation.save();

  const payload = {
    id: message._id.toString(),
    conversationId: conversation._id.toString(),
    encrypted: false,
    encryptedBody: null,
    encryptedPayloads: null,
    senderPublicKey: null,
    body: text,
    adminMessage: true,
    mentions: [],
    createdAt: message.createdAt,
    senderId: admin._id.toString(),
    sender: { id: admin._id.toString(), fullName: admin.fullName, avatar: admin.avatar },
    unsendExpiresAt: new Date(message.createdAt.getTime() + UNSEND_WINDOW_MS),
    forwardedFrom: null,
    replyTo: null,
  };
  req.app.get("io")?.to(`user:${target._id}`).emit("message:new", payload);

  await logAdminAction(admin, {
    action: "admin.message_sent",
    targetType: "user",
    targetId: target._id,
    targetUserId: target._id,
    metadata: { conversationId: conversation._id.toString(), reportId: reportId || null, length: text.length },
  });
  return { id: message._id.toString(), conversationId: conversation._id.toString(), sent: true };
}

// ---- The admin inbox -----------------------------------------------------------

const preview = (text, length = 140) => String(text || "").replace(/\s+/g, " ").slice(0, length);

async function usersMap(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  const users = await User.find({ _id: { $in: unique } }).select("fullName avatar").lean();
  return new Map(users.map((user) => [user._id.toString(), user]));
}

// One list over the three kinds of thing an admin needs to read, newest first:
//   user   - messages users sent to the administrators
//   report - reports users filed (with their description)
//   system - messages administrators sent to users
async function listInbox({ tab, page }) {
  const chosen = TABS.includes(tab) ? tab : "all";
  const current = toPage(page);
  const take = current * PAGE_SIZE; // enough from each source to fill this page after merging

  const wants = {
    user: chosen === "all" || chosen === "unread" || chosen === "user",
    report: chosen === "all" || chosen === "unread" || chosen === "reports",
    system: chosen === "all" || chosen === "system",
  };
  const unreadOnly = chosen === "unread";

  const supportFilter = unreadOnly ? { readAt: { $exists: false } } : {};
  const reportFilter = unreadOnly ? { status: "pending" } : {};

  const [support, reports, system, supportTotal, reportTotal, systemTotal] = await Promise.all([
    wants.user ? SupportMessage.find(supportFilter).sort({ createdAt: -1 }).limit(take).lean() : [],
    wants.report ? Report.find(reportFilter).sort({ createdAt: -1 }).limit(take).lean() : [],
    wants.system ? Message.find({ adminMessage: true, deletedAt: { $exists: false } }).sort({ createdAt: -1 }).limit(take).lean() : [],
    wants.user ? SupportMessage.countDocuments(supportFilter) : 0,
    wants.report ? Report.countDocuments(reportFilter) : 0,
    wants.system ? Message.countDocuments({ adminMessage: true, deletedAt: { $exists: false } }) : 0,
  ]);

  const users = await usersMap([
    ...support.map((item) => item.fromUserId),
    ...reports.flatMap((item) => [item.reporterId, item.targetUserId]),
    ...system.flatMap((item) => [item.senderId, item.recipientId]),
  ]);

  const rows = [
    ...support.map((item) => ({
      kind: "user",
      id: item._id.toString(),
      from: userView(users.get(item.fromUserId.toString())),
      subject: item.subject || `Message about: ${item.category}`,
      preview: preview(item.body),
      target: item.targetType ? { type: item.targetType, id: item.targetId?.toString() } : null,
      reportId: item.reportId ? item.reportId.toString() : null,
      createdAt: item.createdAt,
      read: Boolean(item.readAt),
    })),
    ...reports.map((item) => ({
      kind: "report",
      id: item._id.toString(),
      from: userView(users.get(item.reporterId.toString())),
      subject: `Report: ${item.targetType} · ${item.reason}`,
      preview: preview(item.description || item.snapshot?.text),
      target: { type: item.targetType, id: item.targetId.toString() },
      reportId: item._id.toString(),
      createdAt: item.createdAt,
      read: item.status !== "pending",
    })),
    ...system.map((item) => ({
      kind: "system",
      id: item._id.toString(),
      from: { id: null, fullName: "Kotha-Barta Administration", avatar: null },
      to: userView(users.get(item.recipientId?.toString())),
      subject: `To ${users.get(item.recipientId?.toString())?.fullName || "a user"}`,
      preview: preview(item.body),
      target: null,
      reportId: null,
      createdAt: item.createdAt,
      read: true,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const total = supportTotal + reportTotal + systemTotal;
  return { items: rows, page: current, limit: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

async function getInboxItem(admin, kind, id) {
  if (!mongoose.isValidObjectId(id)) throw new GameError(400, "INVALID_ID", "Invalid id.");
  if (kind === "user") {
    const item = await SupportMessage.findById(id).lean();
    if (!item) throw new GameError(404, "NOT_FOUND", "Message not found.");
    if (!item.readAt) await SupportMessage.updateOne({ _id: item._id, readAt: { $exists: false } }, { $set: { readAt: new Date(), readBy: admin._id } });
    const users = await usersMap([item.fromUserId]);
    let report = null;
    if (item.reportId) {
      const found = await Report.findById(item.reportId).lean();
      if (found) report = serializeReport(found, await usersMap([found.reporterId, found.targetUserId]));
    }
    return {
      kind,
      id: item._id.toString(),
      from: userView(users.get(item.fromUserId.toString())),
      category: item.category,
      subject: item.subject,
      body: item.body,
      target: item.targetType ? { type: item.targetType, id: item.targetId?.toString() } : null,
      report,
      createdAt: item.createdAt,
      read: true,
    };
  }
  if (kind === "system") {
    const item = await Message.findOne({ _id: id, adminMessage: true }).lean();
    if (!item) throw new GameError(404, "NOT_FOUND", "Message not found.");
    const users = await usersMap([item.recipientId, item.senderId]);
    return {
      kind,
      id: item._id.toString(),
      from: userView(users.get(item.senderId.toString())),
      to: userView(users.get(item.recipientId?.toString())),
      subject: "Sent by an administrator",
      body: item.body,
      createdAt: item.createdAt,
      read: true,
    };
  }
  throw new GameError(400, "VALIDATION_ERROR", "Open reports from the Reports page.");
}

async function unreadCount() {
  const [support, reports] = await Promise.all([SupportMessage.countDocuments({ readAt: { $exists: false } }), Report.countDocuments({ status: "pending" })]);
  return { support, reports };
}

module.exports = { TABS, createSupportMessage, sendAdminMessage, listInbox, getInboxItem, unreadCount };
