const express = require("express");
const messages = require("../../services/adminMessages.service");
const { respond } = require("../../utils/gameRespond");

// /admin/messages — mounted behind requireAdminSection("messages").
const router = express.Router();

// Query: tab (all | unread | reports | user | system), page.
router.get("/", respond(async (req) => ({ data: await messages.listInbox({ tab: req.query.tab, page: req.query.page }) })));
router.get("/unread-count", respond(async () => ({ data: await messages.unreadCount() })));
router.get("/:kind/:id", respond(async (req) => ({ data: await messages.getInboxItem(req.user, req.params.kind, req.params.id) })));

// Body: { userId, body, reportId? } — lands in that user's normal Inbox, labelled as an admin message.
router.post("/", respond(async (req) => ({ data: await messages.sendAdminMessage(req.user, req, { userId: req.body?.userId, body: req.body?.body, reportId: req.body?.reportId }) }), 201));

module.exports = router;
