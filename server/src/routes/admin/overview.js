const express = require("express");
const mongoose = require("mongoose");
const ModerationLog = require("../../models/ModerationLog");
const analytics = require("../../services/analytics.service");
const { POLICY } = require("../../utils/moderation");
const { ROLE_SECTIONS } = require("../../middleware/adminAuth");
const { respond } = require("../../utils/gameRespond");

const dashboard = express.Router();
dashboard.get("/", respond(async () => ({ data: await analytics.getDashboard() })));

const analyticsRouter = express.Router();
// Query: range (today | week | month)
analyticsRouter.get("/", respond(async (req) => ({ data: await analytics.getAnalytics(req.query.range) })));

// One page's Today / This Week / This Month numbers, e.g. /admin/analytics/pages/study%2Fquiz
analyticsRouter.get("/pages/:page", respond(async (req) => ({ data: await analytics.getPageAnalytics(req.params.page) })));

// The audit trail. Read-only over HTTP: there is no way to change or remove an entry.
const LOG_PAGE_SIZE = 50;
const logs = express.Router();
logs.get(
  "/",
  respond(async (req) => {
    const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
    const filter = {};
    if (req.query.action) filter.action = new RegExp(`^${String(req.query.action).replace(/[^a-z_.]/gi, "").slice(0, 40)}`);
    if (req.query.adminId && mongoose.isValidObjectId(req.query.adminId)) filter.adminId = req.query.adminId;
    if (req.query.targetUserId && mongoose.isValidObjectId(req.query.targetUserId)) filter.targetUserId = req.query.targetUserId;

    const [items, total] = await Promise.all([
      ModerationLog.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * LOG_PAGE_SIZE)
        .limit(LOG_PAGE_SIZE)
        .populate("adminId", "fullName role")
        .populate("targetUserId", "fullName")
        .lean(),
      ModerationLog.countDocuments(filter),
    ]);
    return {
      data: {
        items: items.map((entry) => ({
          id: entry._id.toString(),
          action: entry.action,
          admin: entry.adminId ? { id: entry.adminId._id.toString(), fullName: entry.adminId.fullName, role: entry.adminId.role } : null,
          targetType: entry.targetType,
          targetId: entry.targetId ? entry.targetId.toString() : null,
          targetUser: entry.targetUserId ? { id: entry.targetUserId._id.toString(), fullName: entry.targetUserId.fullName } : null,
          metadata: entry.metadata || {},
          createdAt: entry.createdAt,
        })),
        page,
        limit: LOG_PAGE_SIZE,
        total,
        totalPages: Math.max(1, Math.ceil(total / LOG_PAGE_SIZE)),
      },
    };
  }),
);

// Read-only view of the moderation policy and role permissions (configured in code / env).
const settings = express.Router();
settings.get(
  "/",
  respond(async () => ({ data: { policy: { banned: POLICY.banned, muted: POLICY.muted }, roleSections: ROLE_SECTIONS } })),
);

module.exports = { dashboard, analytics: analyticsRouter, logs, settings };
