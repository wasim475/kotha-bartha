const express = require("express");
const { requireAuth } = require("../middleware/auth");
const usersRoutes = require("./users.routes");
const postsRoutes = require("./posts.routes");
const commentsRoutes = require("./comments.routes");
const friendsRoutes = require("./friends.routes");
const chatRoutes = require("./chat.routes");
const notificationsRoutes = require("./notifications.routes");
const blocksRoutes = require("./blocks.routes");
const linkPreviewRoutes = require("./link-preview.routes");
const storiesRoutes = require("./stories.routes");
const notesRoutes = require("./notes.routes");
const quizRoutes = require("./quiz.routes");
const leaderboardRoutes = require("./leaderboard.routes");
const gameRoutes = require("./game.routes");
const englishQuestionRoutes = require("./englishQuestions.routes");
const ticTacToeRoutes = require("./ticTacToe.routes");
const gameChallengeRoutes = require("./gameChallenge.routes");
const reportsRoutes = require("./reports.routes");
const adminRoutes = require("./admin");
const { auditStaffContent } = require("../services/adminAudit.service");

const router = express.Router();

router.use(requireAuth);
// Admin Panel API — every route inside re-checks role and account status.
router.use("/admin", adminRoutes);
router.use(reportsRoutes);
router.use(usersRoutes);
router.use(postsRoutes);
router.use(commentsRoutes);
router.use(friendsRoutes);
router.use(chatRoutes);
router.use(notificationsRoutes);
router.use(blocksRoutes);
router.use(linkPreviewRoutes);
router.use(storiesRoutes);
router.use(notesRoutes);
// Staff authoring of Quiz / English-question content is written to the audit log.
router.use(auditStaffContent);
router.use(quizRoutes);
router.use(leaderboardRoutes);
router.use(englishQuestionRoutes);
router.use(ticTacToeRoutes);
router.use(gameChallengeRoutes);
router.use(gameRoutes);

module.exports = router;
