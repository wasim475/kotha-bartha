const express = require("express");
const { createReport } = require("../services/report.service");
const { createSupportMessage } = require("../services/adminMessages.service");
const { respond } = require("../utils/gameRespond");

// User-facing side of moderation: reporting something, and contacting the
// administrators. Both are open to every signed-in account, including banned and
// muted ones (a restricted user must still be able to appeal or report abuse).
// Everything about the reported item is derived on the server; the body names only
// a target and a reason.
const router = express.Router();

// Body: { targetType: user | post | comment | reply, targetId, reason, description? }
router.post("/reports", respond(async (req) => ({ data: await createReport(req.user, req.body) }), 201));

// Body: { body, subject?, category?, reportId?, targetType?, targetId? }
router.post("/support/messages", respond(async (req) => ({ data: await createSupportMessage(req.user, req.body) }), 201));

module.exports = router;
