const express = require("express");
const reports = require("../../services/report.service");
const { respond } = require("../../utils/gameRespond");

// /admin/reports — mounted behind requireAdminSection("reports").
const router = express.Router();

// Query: status (pending | reviewing | resolved | dismissed), targetType, page.
router.get("/", respond(async (req) => ({ data: await reports.listReports(req.query) })));
router.get("/:id", respond(async (req) => ({ data: await reports.getReport(req.params.id) })));

// Body: { action: reviewing | dismiss | resolve | delete_content | ban_user | mute_user, note }
router.patch("/:id", respond(async (req) => ({ data: await reports.updateReport(req.user, req.params.id, { action: req.body?.action, note: req.body?.note }) })));

module.exports = router;
