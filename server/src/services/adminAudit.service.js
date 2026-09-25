const mongoose = require("mongoose");
const ModerationLog = require("../models/ModerationLog");

// Audit logging for the Admin Panel. Entries are only ever created (the model
// refuses updates and deletes). Anything that looks like a credential is dropped
// from `metadata` before it is stored.

const SENSITIVE_KEY = /pass|token|secret|hash|cookie|authorization|credential/i;

function clean(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return depth > 3 ? [] : value.slice(0, 50).map((item) => clean(item, depth + 1));
  if (value instanceof Date || value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === "object") {
    if (depth > 3) return {};
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_KEY.test(key))
        .map(([key, item]) => [key, clean(item, depth + 1)]),
    );
  }
  if (typeof value === "string") return value.slice(0, 500);
  return value;
}

const asObjectId = (value) => (value && mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value.toString()) : null);

// Records one admin action. A failure to write the log is reported loudly but never
// undoes (or blocks) the action that already happened.
async function logAdminAction(admin, { action, targetType = null, targetId = null, targetUserId = null, metadata = {} }) {
  try {
    return await ModerationLog.create({
      adminId: admin._id,
      adminRole: admin.role,
      action,
      targetType,
      targetId: asObjectId(targetId),
      targetUserId: asObjectId(targetUserId),
      metadata: clean(metadata),
    });
  } catch (error) {
    console.error("moderation log failed:", error);
    return null;
  }
}

// Quiz / Game content authoring already exists (routes/quiz.routes.js and
// routes/englishQuestions.routes.js, staff-only). Rather than duplicating those
// handlers, every successful staff mutation on them is logged here, whether it
// arrives through the existing screens or through /admin/quiz and /admin/games.
const CONTENT_RULES = [
  { method: "POST", pattern: /^\/quiz\/subjects$/, action: "quiz.subject_created", targetType: "quiz_subject" },
  { method: "POST", pattern: /^\/quiz\/chapters$/, action: "quiz.chapter_created", targetType: "quiz_chapter" },
  { method: "POST", pattern: /^\/quiz\/chapters\/[^/]+\/questions$/, action: "quiz.question_created", targetType: "quiz_question" },
  { method: "POST", pattern: /^\/quiz\/chapters\/[^/]+\/questions\/bulk$/, action: "quiz.questions_bulk_created", targetType: "quiz_chapter" },
  { method: "POST", pattern: /^\/games\/english-questions$/, action: "game.question_created", targetType: "english_question" },
  { method: "PATCH", pattern: /^\/games\/english-questions\/[^/]+$/, action: "game.question_updated", targetType: "english_question" },
  { method: "PATCH", pattern: /^\/games\/english-questions\/[^/]+\/active$/, action: "game.question_toggled", targetType: "english_question" },
];

const STAFF = new Set(["admin", "moderator"]);

// Express middleware. Cheap for everything that isn't a staff content mutation.
function auditStaffContent(req, res, next) {
  if (req.method === "GET" || !STAFF.has(req.user?.role)) return next();
  const path = (req.path || req.url || "").split("?")[0].replace(/\/+$/, "") || "/";
  const rule = CONTENT_RULES.find((entry) => entry.method === req.method && entry.pattern.test(path));
  if (!rule) return next();

  // The entry is written BEFORE the success response leaves the server, so a
  // client that sees "done" can rely on the audit trail already holding it.
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400) return json(body);
    const data = body?.data;
    const targetId = data?.id || data?._id || path.split("/")[3] || null;
    logAdminAction(req.user, {
      action: rule.action,
      targetType: rule.targetType,
      targetId: mongoose.isValidObjectId(targetId) ? targetId : null,
      metadata: { path, method: req.method, changedFields: Object.keys(req.body || {}).filter((key) => !SENSITIVE_KEY.test(key)).slice(0, 12) },
    }).finally(() => json(body));
    return res;
  };
  next();
}

module.exports = { logAdminAction, auditStaffContent, clean };
