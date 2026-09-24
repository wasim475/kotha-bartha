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

const router = express.Router();

router.use(requireAuth);
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
router.use(quizRoutes);
router.use(leaderboardRoutes);
router.use(gameRoutes);

module.exports = router;
