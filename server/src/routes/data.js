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
    likes: reactions.length,
    comments: await Comment.countDocuments({ postId: post._id }),
    liked: reactions.some(
      (reaction) => reaction.userId.toString() === viewerId.toString(),
    ),
  };
}
async function serializeComment(comment) {
  return {
    id: comment._id.toString(),
    body: comment.body,
    createdAt: comment.createdAt,
    author: safeUser(comment.authorId),
  };
}
function emitToUser(req, userId, event, payload) {
  req.app.get("io")?.to(`user:${userId.toString()}`).emit(event, payload);
}
async function createNotification(req, { recipientId, actorId, type, entityType, entityId, payload, uniqueEventId }) {
  const notification = await Notification.create({ recipientId, actorId, type, entityType, entityId, payload, uniqueEventId });
  await notification.populate("actorId");
  const data = {
    id: notification._id.toString(), type: notification.type, read: false,
    createdAt: notification.createdAt, actor: safeUser(notification.actorId), payload: notification.payload,
  };
  emitToUser(req, recipientId, "notification:new", data);
  return data;
}

router.get("/users/search", async (req, res, next) => {
  try {
    const query = String(req.query.q || "").trim();
    if (!query) return res.json({ data: [], meta: { hasMore: false } });
    const users = await User.find({
      _id: { $ne: req.user._id },
      fullName: { $regex: query, $options: "i" },
    })
      .sort({ fullName: 1 })
      .limit(20);
    res.json({ data: users.map(safeUser), meta: { hasMore: false } });
  } catch (error) {
    next(error);
  }
});

router.patch("/users/me", async (req, res, next) => {
  try {
    const updates = {};
    if (typeof req.body.fullName === "string" && req.body.fullName.trim())
      updates.fullName = req.body.fullName.trim().slice(0, 80);
    if (typeof req.body.bio === "string")
      updates.bio = req.body.bio.trim().slice(0, 240);
    if (["light", "dark"].includes(req.body.theme))
      updates["settings.theme"] = req.body.theme;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true },
    );
    res.json({ data: user.toSafeJSON() });
  } catch (error) {
    next(error);
  }
});

router.get("/users/:userId", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId))
      return res
        .status(400)
        .json({ error: { code: "INVALID_ID", message: "Invalid user id." } });
    const user = await User.findById(req.params.userId);
    if (!user)
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "User not found." } });
    const friendCount = await Friendship.countDocuments({ userIds: user._id });
    const friendship = await Friendship.exists({ userIds: { $all: [req.user._id, user._id] } });
    const sentRequest = await FriendRequest.exists({ senderId: req.user._id, receiverId: user._id, status: "pending" });
    const receivedRequest = await FriendRequest.exists({ senderId: user._id, receiverId: req.user._id, status: "pending" });
    res.json({ data: { ...safeUser(user), friendCount, isFriend: Boolean(friendship), friendRequestSent: Boolean(sentRequest), friendRequestReceived: Boolean(receivedRequest) } });
  } catch (error) {
    next(error);
  }
});

router.get("/users/:userId/posts", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId))
      return res.status(400).json({ error: { code: "INVALID_ID", message: "Invalid user id." } });
    const posts = await Post.find({ authorId: req.params.userId, deletedAt: null })
      .populate("authorId")
      .sort({ createdAt: -1 });
    res.json({ data: await Promise.all(posts.map((post) => serializePost(post, req.user._id))) });
  } catch (error) {
    next(error);
  }
});

router.get("/posts/feed", async (req, res, next) => {
  try {
    const friendships = await Friendship.find({ userIds: req.user._id })
      .select("userIds")
      .lean();
    const friendIds = friendships
      .flatMap((friendship) => friendship.userIds.map(String))
      .filter((id) => id !== req.user._id.toString());
    const allowedAuthors = [req.user._id, ...friendIds];
    const posts = await Post.find({
      authorId: { $in: allowedAuthors },
      deletedAt: null,
    })
      .populate("authorId")
      .sort({ createdAt: -1 })
      .limit(30);
    res.json({
      data: await Promise.all(
        posts.map((post) => serializePost(post, req.user._id)),
      ),
      meta: { hasMore: false },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/posts", async (req, res, next) => {
  try {
    const body = String(req.body.body || "").trim();
    if (!body)
      return res
        .status(400)
        .json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Post text is required.",
          },
        });
    const post = await Post.create({ authorId: req.user._id, body });
    await post.populate("authorId");
    res.status(201).json({ data: await serializePost(post, req.user._id) });
  } catch (error) {
    next(error);
  }
});

router.put("/posts/:postId/like", async (req, res, next) => {
  try {
    const post = await Post.findOne({
      _id: req.params.postId,
      deletedAt: null,
    });
    if (!post)
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Post not found." } });
    if (req.body.liked)
      await Reaction.updateOne(
        { userId: req.user._id, targetType: "post", targetId: post._id },
        { $set: { type: "like" } },
        { upsert: true },
      );
    else
      await Reaction.deleteOne({
        userId: req.user._id,
        targetType: "post",
        targetId: post._id,
      });
    const likes = await Reaction.countDocuments({
      targetType: "post",
      targetId: post._id,
    });
    res.json({ data: { liked: Boolean(req.body.liked), likes } });
  } catch (error) {
    next(error);
  }
});

router.get("/posts/:postId/comments", async (req, res, next) => {
  try {
    const comments = await Comment.find({ postId: req.params.postId })
      .populate("authorId")
      .sort({ createdAt: 1 });
    res.json({ data: await Promise.all(comments.map(serializeComment)) });
  } catch (error) { next(error); }
});

router.post("/posts/:postId/comments", async (req, res, next) => {
  try {
    const body = String(req.body.body || "").trim();
    const post = await Post.findOne({ _id: req.params.postId, deletedAt: null });
    if (!post || !body)
      return res.status(400).json({ error: { code: "INVALID_COMMENT", message: "Comment text is required." } });
    const comment = await Comment.create({ postId: post._id, authorId: req.user._id, body });
    await comment.populate("authorId");
    res.status(201).json({ data: await serializeComment(comment) });
  } catch (error) { next(error); }
});

router.get("/friends", async (req, res, next) => {
  try {
    const tab = ["friends", "requests", "sent"].includes(req.query.tab)
      ? req.query.tab
      : "friends";
    if (tab === "friends") {
      const records = await Friendship.find({ userIds: req.user._id }).lean();
      const ids = records
        .flatMap((record) => record.userIds)
        .filter((id) => id.toString() !== req.user._id.toString());
      const users = await User.find({ _id: { $in: ids } });
      return res.json({
        data: users.map(safeUser),
        meta: { count: users.length },
      });
    }
    const filter =
      tab === "requests"
        ? { receiverId: req.user._id, status: "pending" }
        : { senderId: req.user._id, status: "pending" };
    const requests = await FriendRequest.find(filter)
      .populate("senderId receiverId")
      .sort({ createdAt: -1 });
    return res.json({
      data: requests.map((request) => ({
        id: request._id,
        status: request.status,
        user: safeUser(
          tab === "requests" ? request.senderId : request.receiverId,
        ),
      })),
      meta: { count: requests.length },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/friends/requests", async (req, res, next) => {
  try {
    if (
      !mongoose.isValidObjectId(req.body.receiverId) ||
      req.body.receiverId === req.user._id.toString()
    )
      return res
        .status(400)
        .json({
          error: {
            code: "INVALID_REQUEST",
            message: "Invalid friend request.",
          },
        });
    const receiver = await User.findById(req.body.receiverId);
    if (!receiver)
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "User not found." } });
    const existing = await FriendRequest.findOne({
      senderId: req.user._id,
      receiverId: receiver._id,
      status: "pending",
    });
    if (existing)
      return res
        .status(409)
        .json({
          error: { code: "REQUEST_EXISTS", message: "Request already sent." },
        });
    const request = await FriendRequest.create({
      senderId: req.user._id,
      receiverId: receiver._id,
    });
    res
      .status(201)
      .json({ data: { id: request._id.toString(), status: request.status } });
  } catch (error) {
    next(error);
  }
});

router.delete("/friends/requests/:receiverId", async (req, res, next) => {
  try {
    const request = await FriendRequest.findOneAndDelete({
      senderId: req.user._id,
      receiverId: req.params.receiverId,
      status: "pending",
    });
    await createNotification(req, {
      recipientId: receiver._id, actorId: req.user._id, type: "friend_request",
      entityType: "friend_request", entityId: request._id,
      payload: { message: `${req.user.fullName} sent you a friend request.` },
      uniqueEventId: `friend-request:${request._id}`,
    });
    if (!request)
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Friend request not found." } });
    res.json({ data: { cancelled: true } });
  } catch (error) {
    next(error);
  }
});

router.post("/friends/requests/:requestId/accept", async (req, res, next) => {
  try {
    const request = await FriendRequest.findOne({ _id: req.params.requestId, receiverId: req.user._id, status: "pending" });
    if (!request) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Friend request not found." } });
    request.status = "accepted";
    await request.save();
    await Friendship.updateOne(
      { pairKey: pairKey(request.senderId, request.receiverId) },
      { $setOnInsert: { userIds: [request.senderId, request.receiverId], pairKey: pairKey(request.senderId, request.receiverId) } },
      { upsert: true },
    );
    await createNotification(req, {
      recipientId: request.senderId, actorId: req.user._id, type: "friend_accepted",
      entityType: "user", entityId: req.user._id,
      payload: { message: `${req.user.fullName} accepted your friend request.` },
      uniqueEventId: `friend-accepted:${request._id}`,
    });
    res.json({ data: { accepted: true } });
  } catch (error) { next(error); }
});

router.post("/conversations", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body.userId) || req.body.userId === req.user._id.toString())
      return res.status(400).json({ error: { code: "INVALID_USER", message: "Choose another user to message." } });
    const other = await User.findById(req.body.userId);
    if (!other) return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });
    const key = pairKey(req.user._id, other._id);
    const conversation = await Conversation.findOneAndUpdate(
      { pairKey: key },
      { $setOnInsert: { participantIds: [req.user._id, other._id], pairKey: key } },
      { new: true, upsert: true },
    );
    res.status(201).json({ data: { id: conversation._id.toString() } });
  } catch (error) { next(error); }
});

router.get("/conversations", async (req, res, next) => {
  try {
    const conversations = await Conversation.find({
      participantIds: req.user._id,
    })
      .sort({ updatedAt: -1 })
      .limit(50);
    const otherIds = conversations.map((conversation) =>
      conversation.participantIds.find(
        (id) => id.toString() !== req.user._id.toString(),
      ),
    );
    const users = await User.find({ _id: { $in: otherIds } });
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
      meta: { hasMore: false },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/conversations/:conversationId/messages", async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      participantIds: req.user._id,
    });
    if (!conversation)
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Conversation not found." } });
    conversation.unreadCounts?.set(req.user._id.toString(), 0);
    await conversation.save();
    const messages = await Message.find({ conversationId: conversation._id, deletedAt: null })
      .sort({ createdAt: 1 })
      .lean();
    res.json({ data: messages.map((message) => ({
      id: message._id.toString(),
      body: message.body,
      createdAt: message.createdAt,
      senderId: message.senderId.toString(),
    })) });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/conversations/:conversationId/messages",
  async (req, res, next) => {
    try {
      const body = String(req.body.body || "").trim();
      const conversation = await Conversation.findOne({
        _id: req.params.conversationId,
        participantIds: req.user._id,
      });
      if (!conversation || !body)
        return res
          .status(400)
          .json({
            error: {
              code: "INVALID_MESSAGE",
              message: "Message cannot be empty.",
            },
          });
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
      conversation.unreadCounts?.set(
        recipientId.toString(),
        (conversation.unreadCounts?.get(recipientId.toString()) || 0) + 1,
      );
      await conversation.save();
      emitToUser(req, recipientId, "message:new", {
        id: message._id.toString(), conversationId: conversation._id.toString(),
        body: message.body, createdAt: message.createdAt, senderId: req.user._id.toString(),
      });
      res.status(201).json({ data: message });
    } catch (error) {
      next(error);
    }
  },
);

router.get("/notifications", async (req, res, next) => {
  try {
    const notifications = await Notification.find({ recipientId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("actorId");
    res.json({
      data: notifications.map((notification) => ({
        id: notification._id,
        type: notification.type,
        read: Boolean(notification.readAt),
        createdAt: notification.createdAt,
        actor: notification.actorId ? safeUser(notification.actorId) : null,
        payload: notification.payload,
      })),
      meta: { hasMore: false },
    });
  } catch (error) {
    next(error);
  }
});
router.post("/notifications/read-all", async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipientId: req.user._id, readAt: null },
      { $set: { readAt: new Date() } },
    );
    res.json({ data: { updated: true } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
