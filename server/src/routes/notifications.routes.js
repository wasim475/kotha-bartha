const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const Friendship = require("../models/Friendship");
const FriendRequest = require("../models/FriendRequest");
const Conversation = require("../models/Conversation");
const Post = require("../models/Post");
const Notification = require("../models/Notification");
const { safeUser } = require("../utils/serializers");
const { VISIBLE_CONTENT } = require("../utils/moderation");

const router = express.Router();

router.get("/notifications/unread-counts", async (req, res, next) => {
  try {
    const userId = req.user._id;

    const userIdString = userId.toString();

    // ------------------------------------------------------
    // 1. Notifications
    // ------------------------------------------------------

    const notifications = await Notification.countDocuments({
      recipientId: userId,
      readAt: null,
    });

    // ------------------------------------------------------
    // 2. Friend requests
    // ------------------------------------------------------

    const friends = await FriendRequest.countDocuments({
      receiverId: userId,
      status: "pending",
    });

    // ------------------------------------------------------
    // 3. Messages
    // ------------------------------------------------------

    const conversations = await Conversation.find({
      participantIds: userId,
    })
      .select("unreadCounts")
      .lean();

    const messages = conversations.reduce((total, conversation) => {
      const unreadCounts = conversation.unreadCounts;
      const unread =
        unreadCounts instanceof Map
          ? unreadCounts.get(userIdString)
          : unreadCounts?.[userIdString];

      return total + (Number(unread) > 0 ? 1 : 0);
    }, 0);

    // ------------------------------------------------------
    // 4. Feed
    // ------------------------------------------------------

    const user = await User.findById(userId).select("settings").lean();

    const feedSeenAt = user?.settings?.feedSeenAt
      ? new Date(user.settings.feedSeenAt)
      : new Date(0);

    const friendships = await Friendship.find({
      userIds: userId,
    })
      .select("userIds")
      .lean();

    const friendIds = friendships
      .flatMap((friendship) => friendship.userIds)
      .filter((id) => id.toString() !== userIdString);

    const allowedAuthors = [userId, ...friendIds];

    const feed = await Post.countDocuments({
      authorId: {
        $in: allowedAuthors,
      },
      createdAt: {
        $gt: feedSeenAt,
      },
      deletedAt: null,
      ...VISIBLE_CONTENT,
    });

    res.json({
      data: {
        feed,
        friends,
        messages,
        notifications,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// MARK FEED AS READ
// ============================================================
//
// Feed page open করলে এই endpoint call হবে.
//
// এর ফলে:
//
// নতুন post → badge দেখাবে
// Feed open → badge 0
// আবার নতুন post → badge আবার দেখাবে
//
// ============================================================
router.get("/notifications", async (req, res, next) => {
  try {
    const notifications = await Notification.find({
      recipientId: req.user._id,
    })
      .sort({
        createdAt: -1,
      })
      .limit(50)
      .populate("actorId");

    res.json({
      data: notifications.map((notification) => ({
        id: notification._id.toString(),
        type: notification.type,
        read: Boolean(notification.readAt),
        createdAt: notification.createdAt,
        actor: notification.actorId ? safeUser(notification.actorId) : null,
        payload: notification.payload,
        entityType: notification.entityType,
        entityId: notification.entityId
          ? notification.entityId.toString()
          : null,
        postId: notification.postId ? notification.postId.toString() : null,
        commentId: notification.commentId
          ? notification.commentId.toString()
          : null,
        replyId: notification.replyId ? notification.replyId.toString() : null,
      })),
      meta: {
        hasMore: false,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// MARK ONE NOTIFICATION AS READ
// ============================================================
router.post("/notifications/:notificationId/read", async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.notificationId,
        recipientId: req.user._id,
      },
      {
        $set: {
          readAt: new Date(),
        },
      },
      {
        new: true,
      },
    );

    if (!notification) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Notification not found.",
        },
      });
    }

    res.json({
      data: {
        id: notification._id.toString(),
        read: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// DELETE ONE NOTIFICATION
// ============================================================
router.delete("/notifications/:notificationId", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.notificationId)) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Notification not found.",
        },
      });
    }

    const notification = await Notification.findOneAndDelete({
      _id: req.params.notificationId,
      recipientId: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Notification not found.",
        },
      });
    }

    res.json({
      data: {
        id: notification._id.toString(),
        deleted: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// MARK ALL NOTIFICATIONS AS READ
// ============================================================
router.post("/notifications/read-all", async (req, res, next) => {
  try {
    await Notification.updateMany(
      {
        recipientId: req.user._id,
        readAt: null,
      },
      {
        $set: {
          readAt: new Date(),
        },
      },
    );

    res.json({
      data: {
        updated: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// EXPORT
// ============================================================

module.exports = router;

module.exports = router;
