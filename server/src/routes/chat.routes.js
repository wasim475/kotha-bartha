const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const { pairKey } = require("../utils/ids");
const { safeUser } = require("../utils/serializers");
const { emitToUser } = require("../utils/realtime");

const router = express.Router();

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
    const userId = req.user._id.toString();
    const conversations = await Conversation.find({
      participantIds: req.user._id,
    })
      .sort({
        updatedAt: -1,
      })
      .limit(50);

    const visibleConversations = conversations.filter((conversation) => {
      if (!conversation.hiddenFor?.some((id) => id.toString() === userId)) {
        return true;
      }

      const deletedAt = conversation.deletedAtBy?.get?.(userId);
      return deletedAt && conversation.lastMessageAt > deletedAt;
    });

    const otherIds = visibleConversations.map((conversation) =>
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
      data: visibleConversations.map((conversation) => {
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

router.delete("/conversations/:conversationId", async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      participantIds: req.user._id,
      hiddenFor: { $ne: req.user._id },
    });

    if (!conversation) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Conversation not found.",
        },
      });
    }

    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $addToSet: { hiddenFor: req.user._id },
        $set: {
          [`deletedAtBy.${req.user._id}`]: new Date(),
          [`unreadCounts.${req.user._id}`]: 0,
        },
      },
    );

    res.json({ data: { id: conversation._id.toString() } });
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

      const userId = req.user._id.toString();
      const deletedAt = conversation?.deletedAtBy?.get?.(userId);

      if (
        !conversation ||
        (conversation.hiddenFor?.some((id) => id.toString() === userId) &&
          (!deletedAt || conversation.lastMessageAt <= deletedAt))
      ) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Conversation not found.",
          },
        });
      }

      const unreadMessages = await Message.find({
        conversationId: conversation._id,
        recipientId: req.user._id,
        ...(deletedAt ? { createdAt: { $gt: deletedAt } } : {}),
        status: { $ne: "read" },
        deletedAt: null,
      })
        .select("_id senderId")
        .lean();

      await Message.updateMany(
        {
          conversationId: conversation._id,
          recipientId: req.user._id,
          ...(deletedAt ? { createdAt: { $gt: deletedAt } } : {}),
          status: { $ne: "read" },
          deletedAt: null,
        },
        { $set: { status: "read" } },
      );

      unreadMessages.forEach((message) => {
        emitToUser(req, message.senderId, "message:read", {
          id: message._id.toString(),
          conversationId: conversation._id.toString(),
          status: "read",
        });
      });

      // Mark conversation as read
      conversation.unreadCounts?.set(req.user._id.toString(), 0);

      await conversation.save();

      const messages = await Message.find({
        conversationId: conversation._id,
        ...(deletedAt ? { createdAt: { $gt: deletedAt } } : {}),
        deletedAt: null,
      })
        .populate("replyTo", "body senderId")
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
          status: message.status || "sent",
          replyTo: message.replyTo
            ? {
                id: message.replyTo._id.toString(),
                body: message.replyTo.body,
                senderId: message.replyTo.senderId.toString(),
              }
            : null,
          reactions: (message.reactions || []).map((reaction) => ({
            userId: reaction.userId.toString(),
            emoji: reaction.emoji,
          })),
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

      const userId = req.user._id.toString();
      const deletedAt = conversation?.deletedAtBy?.get?.(userId);
      const isHidden = conversation?.hiddenFor?.some(
        (id) => id.toString() === userId,
      );

      if (
        !conversation ||
        !body ||
        (isHidden && (!deletedAt || conversation.lastMessageAt <= deletedAt))
      ) {
        return res.status(400).json({
          error: {
            code: "INVALID_MESSAGE",
            message: "Message cannot be empty.",
          },
        });
      }

      let replyTo = null;
      if (req.body.replyTo) {
        replyTo = await Message.findOne({
          _id: req.body.replyTo,
          conversationId: conversation._id,
          deletedAt: null,
        });

        if (!replyTo) {
          return res.status(400).json({
            error: {
              code: "INVALID_REPLY",
              message: "The message being replied to was not found.",
            },
          });
        }
      }

      const recipientId = conversation.participantIds.find(
        (id) => id.toString() !== req.user._id.toString(),
      );

      conversation.hiddenFor = (conversation.hiddenFor || []).filter(
        (id) =>
          id.toString() !== req.user._id.toString() &&
          id.toString() !== recipientId.toString(),
      );

      const message = await Message.create({
        conversationId: conversation._id,
        senderId: req.user._id,
        recipientId,
        body,
        replyTo: replyTo?._id || null,
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
        data: {
          id: message._id.toString(),
          body: message.body,
          createdAt: message.createdAt,
          senderId: message.senderId.toString(),
          status: message.status,
          replyTo: replyTo
            ? {
                id: replyTo._id.toString(),
                body: replyTo.body,
                senderId: replyTo.senderId.toString(),
              }
            : null,
          reactions: [],
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================================
// REACT TO MESSAGE
// ============================================================

router.put(
  "/conversations/:conversationId/messages/:messageId/reaction",
  async (req, res, next) => {
    try {
      const emoji = String(req.body.emoji || "").trim();
      const conversation = await Conversation.findOne({
        _id: req.params.conversationId,
        participantIds: req.user._id,
      });

      if (!conversation || !emoji || emoji.length > 8) {
        return res.status(400).json({
          error: { code: "INVALID_REACTION", message: "Invalid reaction." },
        });
      }

      const message = await Message.findOne({
        _id: req.params.messageId,
        conversationId: conversation._id,
        deletedAt: null,
      });

      if (!message) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Message not found." },
        });
      }

      const userId = req.user._id.toString();
      const existing = message.reactions.find(
        (reaction) => reaction.userId.toString() === userId,
      );

      if (existing?.emoji === emoji) {
        message.reactions = message.reactions.filter(
          (reaction) => reaction.userId.toString() !== userId,
        );
      } else if (existing) {
        existing.emoji = emoji;
      } else {
        message.reactions.push({ userId: req.user._id, emoji });
      }

      await message.save();

      const reactions = message.reactions.map((reaction) => ({
        userId: reaction.userId.toString(),
        emoji: reaction.emoji,
      }));
      const payload = {
        id: message._id.toString(),
        conversationId: conversation._id.toString(),
        reactions,
      };
      const recipientId = conversation.participantIds.find(
        (id) => id.toString() !== userId,
      );
      emitToUser(req, recipientId, "message:reaction", payload);

      res.json({ data: payload });
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

module.exports = router;
