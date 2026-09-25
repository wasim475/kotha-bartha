const express = require("express");
const users = require("../../services/adminUsers.service");
const { listReportsForUser } = require("../../services/report.service");
const { respond } = require("../../utils/gameRespond");

// /admin/users — mounted behind requireAdminSection("users") (administrators only).
// The acting admin is always req.user; the only thing taken from the client is
// WHICH account and WHAT to do.
const router = express.Router();

// Exactly 50 per page, paged, searched and filtered in the database.
// Query: page, q (name or email), filter (all | admin | moderator | user | banned | muted)
router.get(
  "/",
  respond(async (req) => ({ data: await users.listUsers({ page: req.query.page, q: req.query.q, filter: req.query.filter }) })),
);

router.get("/:id", respond(async (req) => ({ data: await users.getUser(req.params.id) })));

// Tabs load on demand.
router.get("/:id/posts", respond(async (req) => ({ data: await users.listUserPosts(req.params.id, { page: req.query.page }) })));
router.get(
  "/:id/comments",
  respond(async (req) => ({ data: await users.listUserComments(req.params.id, { page: req.query.page, type: req.query.type === "reply" ? "reply" : "comment" }) })),
);
router.get("/:id/activity", respond(async (req) => ({ data: await users.getUserActivity(req.params.id) })));
router.get(
  "/:id/reports",
  respond(async (req) => ({ data: await listReportsForUser(req.params.id, { direction: req.query.direction === "by" ? "by" : "against", page: req.query.page }) })),
);

router.patch("/:id/role", respond(async (req) => ({ data: await users.setRole(req.user, req.params.id, req.body?.role) })));
router.patch("/:id/ban", respond(async (req) => ({ data: await users.setBan(req.user, req.params.id, req.body?.banned === true, req.body?.reason) })));
router.patch("/:id/mute", respond(async (req) => ({ data: await users.setMute(req.user, req.params.id, req.body?.muted === true, req.body?.reason) })));

// Permanent. Requires { confirm: true } in the body; refused for yourself and for administrators.
router.delete(
  "/:id",
  respond(async (req) => {
    const result = await users.deleteUser(req.user, req.params.id, { confirm: req.body?.confirm });
    req.app.get("io")?.in(`user:${req.params.id}`).disconnectSockets(true);
    return { data: result };
  }),
);

module.exports = router;
