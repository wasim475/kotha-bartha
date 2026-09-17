const express = require("express");
const { requireAuth } = require("../middleware/auth");
const usersRoutes = require("./users.routes");
const postsRoutes = require("./posts.routes");
const commentsRoutes = require("./comments.routes");
const friendsRoutes = require("./friends.routes");
const chatRoutes = require("./chat.routes");
const notificationsRoutes = require("./notifications.routes");

const router = express.Router();

router.use(requireAuth);
router.use(usersRoutes);
router.use(postsRoutes);
router.use(commentsRoutes);
router.use(friendsRoutes);
router.use(chatRoutes);
router.use(notificationsRoutes);

module.exports = router;
