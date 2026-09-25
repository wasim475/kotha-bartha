const express = require("express");
const { requireStaff, requireAdminSection, sectionsFor } = require("../../middleware/adminAuth");
const { auditStaffContent } = require("../../services/adminAudit.service");
const usersRoutes = require("./users");
const contentRoutes = require("./content");
const reportsRoutes = require("./reports");
const messagesRoutes = require("./messages");
const overview = require("./overview");
const quizRoutes = require("../quiz.routes");
const englishQuestionRoutes = require("../englishQuestions.routes");

// The /admin API namespace. Mounted after the global requireAuth, then EVERY
// route here passes requireAdminSection (role + account status, from the
// database) — the browser's route guard is only a convenience.
//
//   admin      -> every section
//   moderator  -> only what the existing role system already gave them: Quiz and
//                 Game content authoring
const router = express.Router();

router.get("/me", requireStaff, (req, res) =>
  res.json({
    data: {
      id: req.user._id.toString(),
      fullName: req.user.fullName,
      role: req.user.role,
      sections: sectionsFor(req.user.role),
    },
  }),
);

router.use("/dashboard", requireAdminSection("dashboard"), overview.dashboard);
router.use("/users", requireAdminSection("users"), usersRoutes);
router.use("/posts", requireAdminSection("posts"), contentRoutes.posts);
router.use("/comments", requireAdminSection("posts"), contentRoutes.comments);
router.use("/reports", requireAdminSection("reports"), reportsRoutes);
router.use("/messages", requireAdminSection("messages"), messagesRoutes);
router.use("/analytics", requireAdminSection("analytics"), overview.analytics);
router.use("/moderation-logs", requireAdminSection("logs"), overview.logs);
router.use("/settings", requireAdminSection("settings"), overview.settings);

// Quiz and Game content management reuse the existing services and endpoints (they
// keep their own staff-only checks) instead of duplicating them:
//   /admin/quiz/...   -> /quiz/...
//   /admin/games/...  -> /games/...   (the English question bank)
// Every successful mutation is recorded in the audit log.
const reuse = (prefix, target) => (req, res, next) => {
  req.url = `${prefix}${req.url === "/" ? "" : req.url}`;
  auditStaffContent(req, res, () => target(req, res, next));
};
router.use("/quiz", requireAdminSection("quiz"), reuse("/quiz", quizRoutes));
router.use("/games", requireAdminSection("games"), reuse("/games", englishQuestionRoutes));

module.exports = router;
