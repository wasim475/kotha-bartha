const express = require("express");
const mongoose = require("mongoose");
const { requireAuth } = require("../middleware/auth");

const User = require("../models/User");
const Post = require("../models/Post");
const Friendship = require("../models/Friendship");
const FriendRequest = require("../models/FriendRequest");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const Reaction = require("../models/Reaction");
const Comment = require("../models/Comment");

const router = express.Router();

router.use(requireAuth);

// ============================================================
// Helpers
// ============================================================

function idsFor(userId, targetId) {
  return [userId.toString(), targetId.toString()].sort();
}

function pairKey(userId, targetId) {
  return idsFor(userId, targetId).join(":");
}

function initials(name = "") {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function safeUser(user) {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    bio: user.bio,
    avatar: user.avatar,
    cover: user.cover,
    initials: initials(user.fullName),
    lastSeenAt: user.lastSeenAt,
  };
}

async function serializePost(post, viewerId) {
  const reactions = await Reaction.find({
    targetType: "post",
    targetId: post._id,
  })
    .select("userId")
    .lean();

  return {
    id: post._id.toString(),
    body: post.body,
    media: post.media,
    createdAt: post.createdAt,
    author: safeUser(post.authorId),
    editable: post.authorId._id.toString() === viewerId.toString(),
    likes: reactions.length,
    comments: await Comment.countDocuments({
      postId: post._id,
    }),
    liked: reactions.some(
      (reaction) => reaction.userId.toString() === viewerId.toString(),
    ),
  };
}

async function serializeComment(comment, viewerId) {
  const reactions = await Reaction.find({
    targetType: "comment",
    targetId: comment._id,
  })
    .select("userId type")
    .lean();

  return {
    id: comment._id.toString(),
    body: comment.body,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: safeUser(comment.authorId),
    editable: comment.authorId._id.toString() === viewerId.toString(),
    reaction: reactions.find(
      (entry) => entry.userId.toString() === viewerId.toString(),
    )?.type || null,
    reactions: reactions.reduce((counts, entry) => ({
      ...counts,
      [entry.type]: (counts[entry.type] || 0) + 1,
    }), {}),
  };
}

function emitToUser(req, userId, event, payload) {
  req.app.get("io")?.to(`user:${userId.toString()}`).emit(event, payload);
}

// ============================================================
// Notification helper
// ============================================================

async function createNotification(
  req,
  { recipientId, actorId, type, entityType, entityId, payload, uniqueEventId },
) {
  const notification = await Notification.create({
    recipientId,
    actorId,
    type,
    entityType,
    entityId,
    payload,
    uniqueEventId,
  });

  await notification.populate("actorId");

  const data = {
    id: notification._id.toString(),
    type: notification.type,
    read: false,
    createdAt: notification.createdAt,
    actor: notification.actorId ? safeUser(notification.actorId) : null,
    payload: notification.payload,
  };

  emitToUser(req, recipientId, "notification:new", data);

  return data;
}

// ============================================================
// USERS
// ============================================================

router.get("/users", async (req, res, next) => {
  try {
    const users = await User.find({
      _id: {
        $ne: req.user._id,
      },
    }).sort({
      fullName: 1,
    });

    res.json({
      data: users.map(safeUser),
      meta: {
        count: users.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// USER SEARCH
// ============================================================

router.get("/users/search", async (req, res, next) => {
  try {
    const query = String(req.query.q || "").trim();

    if (!query) {
      return res.json({
        data: [],
        meta: {
          hasMore: false,
        },
      });
    }

    const users = await User.find({
      _id: {
        $ne: req.user._id,
      },
      fullName: {
        $regex: query,
        $options: "i",
      },
    })
      .sort({
        fullName: 1,
      })
      .limit(20);

    res.json({
      data: users.map(safeUser),
      meta: {
        hasMore: false,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// UPDATE MY PROFILE
// ============================================================

router.patch("/users/me", async (req, res, next) => {
  try {
    const updates = {};

    if (typeof req.body.fullName === "string" && req.body.fullName.trim()) {
      updates.fullName = req.body.fullName.trim().slice(0, 80);
    }

    if (typeof req.body.bio === "string") {
      updates.bio = req.body.bio.trim().slice(0, 240);
    }

    if (["light", "dark"].includes(req.body.theme)) {
      updates["settings.theme"] = req.body.theme;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: updates,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    res.json({
      data: user.toSafeJSON(),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// USER PROFILE
// ============================================================

router.get("/users/:userId", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({
        error: {
          code: "INVALID_ID",
          message: "Invalid user id.",
        },
      });
    }

    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "User not found.",
        },
      });
    }

    const friendCount = await Friendship.countDocuments({
      userIds: user._id,
    });

    const friendship = await Friendship.exists({
      userIds: {
        $all: [req.user._id, user._id],
      },
    });

    const sentRequest = await FriendRequest.exists({
      senderId: req.user._id,
      receiverId: user._id,
      status: "pending",
    });

    const receivedRequest = await FriendRequest.findOne({
      senderId: user._id,
      receiverId: req.user._id,
      status: "pending",
    })
      .select("_id")
      .lean();

    res.json({
      data: {
        ...safeUser(user),
        friendCount,
        isFriend: Boolean(friendship),
        friendRequestSent: Boolean(sentRequest),
        friendRequestReceived: Boolean(receivedRequest),
        receivedFriendRequestId: receivedRequest?._id?.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// USER POSTS
// ============================================================

router.get("/users/:userId/posts", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({
        error: {
          code: "INVALID_ID",
          message: "Invalid user id.",
        },
      });
    }

    const posts = await Post.find({
      authorId: req.params.userId,
      deletedAt: null,
    })
      .populate("authorId")
      .sort({
        createdAt: -1,
      });

    res.json({
      data: await Promise.all(
        posts.map((post) => serializePost(post, req.user._id)),
      ),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// FEED
// ============================================================

router.get("/posts/feed", async (req, res, next) => {
  try {
    const friendships = await Friendship.find({
      userIds: req.user._id,
    })
      .select("userIds")
      .lean();

    const friendIds = friendships
      .flatMap((friendship) => friendship.userIds.map(String))
      .filter((id) => id !== req.user._id.toString());

    const allowedAuthors = [req.user._id, ...friendIds];

    const posts = await Post.find({
      authorId: {
        $in: allowedAuthors,
      },
      deletedAt: null,
    })
      .populate("authorId")
      .sort({
        createdAt: -1,
      })
      .limit(30);

    res.json({
      data: await Promise.all(
        posts.map((post) => serializePost(post, req.user._id)),
      ),
      meta: {
        hasMore: false,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// CREATE POST
// ============================================================

router.post("/posts", async (req, res, next) => {
  try {
    const body = String(req.body.body || "").trim();

    if (!body) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Post text is required.",
        },
      });
    }

    const post = await Post.create({
      authorId: req.user._id,
      body,
    });

    // --------------------------------------------------------
    // NEW:
    // Notify all friends that a new feed post exists
    // --------------------------------------------------------

    const friendships = await Friendship.find({
      userIds: req.user._id,
    })
      .select("userIds")
      .lean();

    const friendIds = friendships
      .flatMap((friendship) => friendship.userIds)
      .filter((id) => id.toString() !== req.user._id.toString());

    for (const friendId of friendIds) {
      emitToUser(req, friendId, "post:new", {
        postId: post._id.toString(),
        authorId: req.user._id.toString(),
        createdAt: post.createdAt,
      });
    }

    await post.populate("authorId");

    res.status(201).json({
      data: await serializePost(post, req.user._id),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// LIKE POST
// ============================================================

router.put("/posts/:postId/like", async (req, res, next) => {
  try {
    const post = await Post.findOne({
      _id: req.params.postId,
      deletedAt: null,
    });

    if (!post) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Post not found.",
        },
      });
    }

    if (req.body.liked) {
      await Reaction.updateOne(
        {
          userId: req.user._id,
          targetType: "post",
          targetId: post._id,
        },
        {
          $set: {
            type: "like",
          },
        },
        {
          upsert: true,
        },
      );
    } else {
      await Reaction.deleteOne({
        userId: req.user._id,
        targetType: "post",
        targetId: post._id,
      });
    }

    // ------------------------------------------------------
    // Like notification
    // ------------------------------------------------------

    if (
      req.body.liked &&
      post.authorId.toString() !== req.user._id.toString()
    ) {
      await createNotification(req, {
        recipientId: post.authorId,
        actorId: req.user._id,
        type: "post_like",
        entityType: "post",
        entityId: post._id,
        payload: {
          message: `${req.user.fullName} liked your post.`,
        },
        uniqueEventId: `post-like:${post._id}:${req.user._id}`,
      });
    }

    const likes = await Reaction.countDocuments({
      targetType: "post",
      targetId: post._id,
    });

    res.json({
      data: {
        liked: Boolean(req.body.liked),
        likes,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET COMMENTS
// ============================================================

router.get("/posts/:postId/comments", async (req, res, next) => {
  try {
    const comments = await Comment.find({
      postId: req.params.postId,
    })
      .populate("authorId")
      .sort({
        createdAt: 1,
      });

    res.json({
      data: await Promise.all(
        comments.map((comment) => serializeComment(comment, req.user._id)),
      ),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// CREATE COMMENT
// ============================================================

router.post("/posts/:postId/comments", async (req, res, next) => {
  try {
    const body = String(req.body.body || "").trim();

    const post = await Post.findOne({
      _id: req.params.postId,
      deletedAt: null,
    });

    if (!post || !body) {
      return res.status(400).json({
        error: {
          code: "INVALID_COMMENT",
          message: "Comment text is required.",
        },
      });
    }

    const comment = await Comment.create({
      postId: post._id,
      authorId: req.user._id,
      body,
    });

    await comment.populate("authorId");

    const previousCommenters = await Comment.find({
      postId: post._id,
      _id: { $ne: comment._id },
    })
      .sort({ createdAt: -1 })
      .select("authorId")
      .lean();

    // ------------------------------------------------------
    // Comment notification
    // ------------------------------------------------------

    if (post.authorId.toString() !== req.user._id.toString()) {
      await createNotification(req, {
        recipientId: post.authorId,
        actorId: req.user._id,
        type: "post_comment",
        entityType: "post",
        entityId: post._id,
        payload: {
          message: `${req.user.fullName} commented on your post.`,
        },
        uniqueEventId: `post-comment:${comment._id}`,
      });
    }

    const recipients = new Set(
      previousCommenters
        .map((entry) => entry.authorId.toString())
        .filter((id) => id !== req.user._id.toString()),
    );

    for (const recipientId of recipients) {
      if (recipientId === post.authorId.toString()) continue;

      await createNotification(req, {
        recipientId,
        actorId: req.user._id,
        type: "post_comment",
        entityType: "post",
        entityId: post._id,
        payload: {
          message: `${req.user.fullName} also commented on a post you joined.`,
        },
        uniqueEventId: `post-comment:${comment._id}:${recipientId}`,
      });
    }

    res.status(201).json({
      data: await serializeComment(comment, req.user._id),
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/posts/:postId", async (req, res, next) => {
  try {
    const body = String(req.body.body || "").trim();
    const post = await Post.findOne({
      _id: req.params.postId,
      authorId: req.user._id,
      deletedAt: null,
    });

    if (!post || !body) {
      return res.status(400).json({
        error: { code: "INVALID_POST", message: "Post text is required." },
      });
    }

    post.body = body;
    await post.save();
    await post.populate("authorId");

    res.json({ data: await serializePost(post, req.user._id) });
  } catch (error) {
    next(error);
  }
});

router.delete("/posts/:postId", async (req, res, next) => {
  try {
    const post = await Post.findOneAndUpdate(
      { _id: req.params.postId, authorId: req.user._id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true },
    );

    if (!post) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Post not found." },
      });
    }

    res.json({ data: { id: post._id.toString(), deleted: true } });
  } catch (error) {
    next(error);
  }
});

router.patch("/comments/:commentId", async (req, res, next) => {
  try {
    const body = String(req.body.body || "").trim();
    const comment = await Comment.findOne({
      _id: req.params.commentId,
      authorId: req.user._id,
    }).populate("authorId");

    if (!comment || !body) {
      return res.status(400).json({
        error: { code: "INVALID_COMMENT", message: "Comment text is required." },
      });
    }

    comment.body = body;
    await comment.save();
    res.json({ data: await serializeComment(comment, req.user._id) });
  } catch (error) {
    next(error);
  }
});

router.delete("/comments/:commentId", async (req, res, next) => {
  try {
    const comment = await Comment.findOneAndDelete({
      _id: req.params.commentId,
      authorId: req.user._id,
    });

    if (!comment) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Comment not found." },
      });
    }

    await Reaction.deleteMany({ targetType: "comment", targetId: comment._id });
    res.json({ data: { id: comment._id.toString(), deleted: true } });
  } catch (error) {
    next(error);
  }
});

router.put("/comments/:commentId/reaction", async (req, res, next) => {
  try {
    const allowedTypes = ["like", "haha", "sad", "angry"];
    const type = req.body.type;
    const comment = await Comment.findById(req.params.commentId);

    if (!comment || (type && !allowedTypes.includes(type))) {
      return res.status(400).json({
        error: { code: "INVALID_REACTION", message: "Invalid comment reaction." },
      });
    }

    if (!type) {
      await Reaction.deleteOne({
        userId: req.user._id,
        targetType: "comment",
        targetId: comment._id,
      });
    } else {
      await Reaction.updateOne(
        {
          userId: req.user._id,
          targetType: "comment",
          targetId: comment._id,
        },
        { $set: { type } },
        { upsert: true },
      );
    }

    const reactions = await Reaction.find({
      targetType: "comment",
      targetId: comment._id,
    }).select("type").lean();

    res.json({
      data: {
        reaction: type || null,
        reactions: reactions.reduce((counts, entry) => ({
          ...counts,
          [entry.type]: (counts[entry.type] || 0) + 1,
        }), {}),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// FRIENDS
// ============================================================

router.get("/friends", async (req, res, next) => {
  try {
    const tab = ["friends", "requests", "sent"].includes(req.query.tab)
      ? req.query.tab
      : "friends";

    if (tab === "friends") {
      const records = await Friendship.find({
        userIds: req.user._id,
      }).lean();

      const ids = records
        .flatMap((record) => record.userIds)
        .filter((id) => id.toString() !== req.user._id.toString());

      const users = await User.find({
        _id: {
          $in: ids,
        },
      });

      return res.json({
        data: users.map(safeUser),
        meta: {
          count: users.length,
        },
      });
    }

    const filter =
      tab === "requests"
        ? {
            receiverId: req.user._id,
            status: "pending",
          }
        : {
            senderId: req.user._id,
            status: "pending",
          };

    const requests = await FriendRequest.find(filter)
      .populate("senderId receiverId")
      .sort({
        createdAt: -1,
      });

    return res.json({
      data: requests.map((request) => ({
        id: request._id,
        status: request.status,
        user: safeUser(
          tab === "requests" ? request.senderId : request.receiverId,
        ),
      })),
      meta: {
        count: requests.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// SEND FRIEND REQUEST
// ============================================================

router.post("/friends/requests", async (req, res, next) => {
  try {
    if (
      !mongoose.isValidObjectId(req.body.receiverId) ||
      req.body.receiverId === req.user._id.toString()
    ) {
      return res.status(400).json({
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid friend request.",
        },
      });
    }

    const receiver = await User.findById(req.body.receiverId);

    if (!receiver) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "User not found.",
        },
      });
    }

    // Already friends?
    const alreadyFriends = await Friendship.exists({
      userIds: {
        $all: [req.user._id, receiver._id],
      },
    });

    if (alreadyFriends) {
      return res.status(409).json({
        error: {
          code: "ALREADY_FRIENDS",
          message: "You are already friends.",
        },
      });
    }

    const existing = await FriendRequest.findOne({
      senderId: req.user._id,
      receiverId: receiver._id,
      status: "pending",
    });

    if (existing) {
      return res.status(409).json({
        error: {
          code: "REQUEST_EXISTS",
          message: "Request already sent.",
        },
      });
    }

    const request = await FriendRequest.create({
      senderId: req.user._id,
      receiverId: receiver._id,
    });

    // ------------------------------------------------------
    // Friend request notification
    // ------------------------------------------------------

    await createNotification(req, {
      recipientId: receiver._id,
      actorId: req.user._id,
      type: "friend_request",
      entityType: "friend_request",
      entityId: request._id,
      payload: {
        message: `${req.user.fullName} sent you a friend request.`,
      },
      uniqueEventId: `friend-request:${request._id}`,
    });

    // Extra realtime event for Friends badge
    emitToUser(req, receiver._id, "friend:new", {
      requestId: request._id.toString(),
      senderId: req.user._id.toString(),
    });

    res.status(201).json({
      data: {
        id: request._id.toString(),
        status: request.status,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// CANCEL FRIEND REQUEST
// ============================================================

router.delete("/friends/requests/:receiverId", async (req, res, next) => {
  try {
    const request = await FriendRequest.findOneAndDelete({
      senderId: req.user._id,
      receiverId: req.params.receiverId,
      status: "pending",
    });

    if (!request) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Friend request not found.",
        },
      });
    }

    res.json({
      data: {
        cancelled: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// ACCEPT FRIEND REQUEST
// ============================================================

router.post("/friends/requests/:requestId/accept", async (req, res, next) => {
  try {
    const request = await FriendRequest.findOne({
      _id: req.params.requestId,
      receiverId: req.user._id,
      status: "pending",
    });

    if (!request) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Friend request not found.",
        },
      });
    }

    request.status = "accepted";

    await request.save();

    await Friendship.updateOne(
      {
        pairKey: pairKey(request.senderId, request.receiverId),
      },
      {
        $setOnInsert: {
          userIds: [request.senderId, request.receiverId],
          pairKey: pairKey(request.senderId, request.receiverId),
        },
      },
      {
        upsert: true,
      },
    );

    // ------------------------------------------------------
    // Accepted notification
    // ------------------------------------------------------

    await createNotification(req, {
      recipientId: request.senderId,
      actorId: req.user._id,
      type: "friend_accepted",
      entityType: "user",
      entityId: req.user._id,
      payload: {
        message: `${req.user.fullName} accepted your friend request.`,
      },
      uniqueEventId: `friend-accepted:${request._id}`,
    });

    // Realtime friend update
    emitToUser(req, request.senderId, "friend:accepted", {
      userId: req.user._id.toString(),
    });

    res.json({
      data: {
        accepted: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// CREATE / GET CONVERSATION
// ============================================================

router.post("/conversations", async (req, res, next) => {
  try {
    if (
      !mongoose.isValidObjectId(req.body.userId) ||
      req.body.userId === req.user._id.toString()
    ) {
      return res.status(400).json({
        error: {
          code: "INVALID_USER",
          message: "Choose another user to message.",
        },
      });
    }

    const other = await User.findById(req.body.userId);

    if (!other) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "User not found.",
        },
      });
    }

    const key = pairKey(req.user._id, other._id);

    const conversation = await Conversation.findOneAndUpdate(
      {
        pairKey: key,
      },
      {
        $setOnInsert: {
          participantIds: [req.user._id, other._id],
          pairKey: key,
        },
      },
      {
        new: true,
        upsert: true,
      },
    );

    res.status(201).json({
      data: {
        id: conversation._id.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// CONVERSATIONS
// ============================================================

router.get("/conversations", async (req, res, next) => {
  try {
    const conversations = await Conversation.find({
      participantIds: req.user._id,
    })
      .sort({
        updatedAt: -1,
      })
      .limit(50);

    const otherIds = conversations.map((conversation) =>
      conversation.participantIds.find(
        (id) => id.toString() !== req.user._id.toString(),
      ),
    );

    const users = await User.find({
      _id: {
        $in: otherIds,
      },
    });

    const byId = new Map(users.map((user) => [user._id.toString(), user]));

    res.json({
      data: conversations.map((conversation) => {
        const other = byId.get(
          conversation.participantIds
            .find((id) => id.toString() !== req.user._id.toString())
            .toString(),
        );

        return {
          id: conversation._id,
          user: safeUser(other),
          lastMessage: conversation.lastMessage,
          lastMessageAt: conversation.lastMessageAt,
          unreadCount:
            conversation.unreadCounts?.get?.(req.user._id.toString()) || 0,
        };
      }),
      meta: {
        hasMore: false,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET MESSAGES
//
// Opening a conversation automatically marks
// that conversation's unread messages as read.
// ============================================================

router.get(
  "/conversations/:conversationId/messages",
  async (req, res, next) => {
    try {
      const conversation = await Conversation.findOne({
        _id: req.params.conversationId,
        participantIds: req.user._id,
      });

      if (!conversation) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Conversation not found.",
          },
        });
      }

      // Mark conversation as read
      conversation.unreadCounts?.set(req.user._id.toString(), 0);

      await conversation.save();

      const messages = await Message.find({
        conversationId: conversation._id,
        deletedAt: null,
      })
        .sort({
          createdAt: 1,
        })
        .lean();

      res.json({
        data: messages.map((message) => ({
          id: message._id.toString(),
          body: message.body,
          createdAt: message.createdAt,
          senderId: message.senderId.toString(),
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================================
// SEND MESSAGE
// ============================================================

router.post(
  "/conversations/:conversationId/messages",
  async (req, res, next) => {
    try {
      const body = String(req.body.body || "").trim();

      const conversation = await Conversation.findOne({
        _id: req.params.conversationId,
        participantIds: req.user._id,
      });

      if (!conversation || !body) {
        return res.status(400).json({
          error: {
            code: "INVALID_MESSAGE",
            message: "Message cannot be empty.",
          },
        });
      }

      const recipientId = conversation.participantIds.find(
        (id) => id.toString() !== req.user._id.toString(),
      );

      const message = await Message.create({
        conversationId: conversation._id,
        senderId: req.user._id,
        recipientId,
        body,
        status: "delivered",
      });

      conversation.lastMessage = body;

      conversation.lastMessageAt = message.createdAt;

      // Increase recipient unread count
      conversation.unreadCounts?.set(
        recipientId.toString(),
        (conversation.unreadCounts?.get(recipientId.toString()) || 0) + 1,
      );

      await conversation.save();

      // Realtime new message
      emitToUser(req, recipientId, "message:new", {
        id: message._id.toString(),
        conversationId: conversation._id.toString(),
        body: message.body,
        createdAt: message.createdAt,
        senderId: req.user._id.toString(),
      });

      res.status(201).json({
        data: message,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================================
// EDIT MESSAGE
// ============================================================

router.patch(
  "/conversations/:conversationId/messages/:messageId",
  async (req, res, next) => {
    try {
      const body = String(req.body.body || "").trim();

      if (!body) {
        return res.status(400).json({
          error: {
            code: "INVALID_MESSAGE",
            message: "Message cannot be empty.",
          },
        });
      }

      const conversation = await Conversation.findOne({
        _id: req.params.conversationId,
        participantIds: req.user._id,
      });

      if (!conversation) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Conversation not found.",
          },
        });
      }

      // Only own message can be edited
      const message = await Message.findOne({
        _id: req.params.messageId,
        conversationId: conversation._id,
        senderId: req.user._id,
        deletedAt: null,
      });

      if (!message) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Message not found or you cannot edit this message.",
          },
        });
      }

      message.body = body;

      message.editedAt = new Date();

      await message.save();

      const recipientId = conversation.participantIds.find(
        (id) => id.toString() !== req.user._id.toString(),
      );

      // Realtime update
      emitToUser(req, recipientId, "message:updated", {
        id: message._id.toString(),
        conversationId: conversation._id.toString(),
        body: message.body,
        senderId: message.senderId.toString(),
        editedAt: message.editedAt,
      });

      // Update last message if needed
      if (
        conversation.lastMessageAt &&
        new Date(conversation.lastMessageAt).getTime() ===
          new Date(message.createdAt).getTime()
      ) {
        conversation.lastMessage = body;

        await conversation.save();
      }

      res.json({
        data: {
          id: message._id.toString(),
          body: message.body,
          createdAt: message.createdAt,
          editedAt: message.editedAt,
          senderId: message.senderId.toString(),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================================
// DELETE MESSAGE
// ============================================================

router.delete(
  "/conversations/:conversationId/messages/:messageId",
  async (req, res, next) => {
    try {
      const conversation = await Conversation.findOne({
        _id: req.params.conversationId,
        participantIds: req.user._id,
      });

      if (!conversation) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Conversation not found.",
          },
        });
      }

      // Only own message can be deleted
      const message = await Message.findOne({
        _id: req.params.messageId,
        conversationId: conversation._id,
        senderId: req.user._id,
        deletedAt: null,
      });

      if (!message) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Message not found or you cannot delete this message.",
          },
        });
      }

      // Soft delete
      message.deletedAt = new Date();

      await message.save();

      const recipientId = conversation.participantIds.find(
        (id) => id.toString() !== req.user._id.toString(),
      );

      // Realtime delete
      emitToUser(req, recipientId, "message:deleted", {
        id: message._id.toString(),
        conversationId: conversation._id.toString(),
        senderId: message.senderId.toString(),
      });

      // Update last message
      if (
        conversation.lastMessageAt &&
        new Date(conversation.lastMessageAt).getTime() ===
          new Date(message.createdAt).getTime()
      ) {
        const lastMessage = await Message.findOne({
          conversationId: conversation._id,
          deletedAt: null,
        }).sort({
          createdAt: -1,
        });

        conversation.lastMessage = lastMessage?.body || "";

        conversation.lastMessageAt = lastMessage?.createdAt || null;

        await conversation.save();
      }

      res.json({
        data: {
          id: message._id.toString(),
          deleted: true,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================================
// ============================================================
// UNREAD COUNTS
// ============================================================
// ============================================================
//
// Returns:
//
// {
//   feed: 0,
//   friends: 0,
//   messages: 0,
//   notifications: 0
// }
//
// Navbar এই endpoint থেকে badge count পাবে.
// ============================================================

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
      let unread = 0;

      if (conversation.unreadCounts?.get) {
        unread = conversation.unreadCounts.get(userIdString) || 0;
      } else if (conversation.unreadCounts) {
        unread = conversation.unreadCounts[userIdString] || 0;
      }

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

router.post("/posts/feed/read", async (req, res, next) => {
  try {
    const now = new Date();

    await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          "settings.feedSeenAt": now,
        },
      },
      {
        new: true,
      },
    );

    res.json({
      data: {
        read: true,
        feedSeenAt: now,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// NOTIFICATIONS
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
