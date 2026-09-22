const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const { pairKey } = require("../utils/ids");
const { safeUser } = require("../utils/serializers");
const { emitToUser } = require("../utils/realtime");
const { isBlockedEitherWay } = require("../utils/blocks");
const { isOnline } = require("../utils/presence");
const { upload, attachmentKindFor } = require("../middleware/upload");
const { uploadBuffer, destroyAsset } = require("../utils/cloudinary");

const router = express.Router();

// ============================================================
// Shared helpers — every route below used to assume exactly two
// participants (a single `recipientId`). Groups can have many, so these
// helpers work the same for both: a 1-to-1 conversation is just a group
// of two without a name.
// ============================================================

const otherParticipants = (conversation, excludeUserId) =>
  conversation.participantIds.filter(
    (id) => id.toString() !== excludeUserId.toString(),
  );

const clearHiddenFor = (conversation, ids) => {
  const idStrings = new Set([...ids].map((id) => id.toString()));
  conversation.hiddenFor = (conversation.hiddenFor || []).filter(
    (id) => !idStrings.has(id.toString()),
  );
};

const bumpUnreadFor = (conversation, ids) => {
  ids.forEach((id) => {
    const key = id.toString();
    conversation.unreadCounts?.set(key, (conversation.unreadCounts?.get(key) || 0) + 1);
  });
};

const broadcastToOthers = (req, ids, event, payload) => {
  ids.forEach((id) => emitToUser(req, id, event, payload));
};

// Block rules apply only to 1-to-1 conversations. A group can contain
// members who have blocked each other elsewhere — that only ever affects
// their own direct conversation, not their shared group membership.
const isBlockedForSend = async (conversation, userId, others) => {
  if (conversation.isGroup) return false;
  return isBlockedEitherWay(userId, others[0]);
};

const groupSummary = (conversation) => ({
  id: conversation._id.toString(),
  name: conversation.groupName,
  avatar: conversation.groupAvatar,
  memberCount: conversation.participantIds.length,
  adminIds: (conversation.adminIds || []).map((id) => id.toString()),
});

const isGroupAdmin = (conversation, userId) =>
  (conversation.adminIds || []).some((id) => id.toString() === userId.toString());

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

    if (await isBlockedEitherWay(req.user._id, other._id)) {
      return res.status(403).json({
        error: {
          code: "BLOCKED",
          message: "You can't message this user.",
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
// GROUPS
// ============================================================

router.post("/conversations/group", async (req, res, next) => {
  try {
    const groupName = String(req.body.groupName || "").trim();
    const memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];
    const validIds = [...new Set(memberIds)].filter(
      (id) => mongoose.isValidObjectId(id) && id !== req.user._id.toString(),
    );

    if (!groupName) {
      return res.status(400).json({
        error: { code: "INVALID_GROUP", message: "Give the group a name." },
      });
    }
    if (validIds.length < 1) {
      return res.status(400).json({
        error: { code: "INVALID_GROUP", message: "Add at least one other member." },
      });
    }

    const members = await User.find({ _id: { $in: validIds } }).select("_id");
    const memberObjectIds = members.map((user) => user._id);

    const conversation = await Conversation.create({
      participantIds: [req.user._id, ...memberObjectIds],
      isGroup: true,
      groupName,
      adminIds: [req.user._id],
      createdBy: req.user._id,
    });

    res.status(201).json({ data: { id: conversation._id.toString() } });
  } catch (error) {
    next(error);
  }
});

router.get("/conversations/:conversationId", async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      participantIds: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Conversation not found." },
      });
    }

    if (!conversation.isGroup) {
      const otherId = otherParticipants(conversation, req.user._id)[0];
      const other = await User.findById(otherId);
      return res.json({
        data: {
          id: conversation._id.toString(),
          isGroup: false,
          user: other ? { ...safeUser(other), isOnline: isOnline(other._id) } : null,
        },
      });
    }

    const members = await User.find({ _id: { $in: conversation.participantIds } });
    res.json({
      data: {
        id: conversation._id.toString(),
        isGroup: true,
        ...groupSummary(conversation),
        members: members.map((member) => ({
          ...safeUser(member),
          isOnline: isOnline(member._id),
          isAdmin: isGroupAdmin(conversation, member._id),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/conversations/:conversationId", async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      participantIds: req.user._id,
      isGroup: true,
    });

    if (!conversation) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Group not found." },
      });
    }
    if (!isGroupAdmin(conversation, req.user._id)) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "Only a group admin can do that." },
      });
    }

    if (typeof req.body.groupName === "string") {
      const name = req.body.groupName.trim();
      if (!name) {
        return res.status(400).json({
          error: { code: "INVALID_GROUP", message: "Group name can't be empty." },
        });
      }
      conversation.groupName = name;
    }

    await conversation.save();

    const others = otherParticipants(conversation, req.user._id);
    broadcastToOthers(req, others, "conversation:updated", {
      id: conversation._id.toString(),
      ...groupSummary(conversation),
    });

    res.json({ data: { id: conversation._id.toString(), ...groupSummary(conversation) } });
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/conversations/:conversationId/avatar",
  (req, res, next) => {
    upload.single("file")(req, res, (error) => {
      if (!error) return next();
      if (error.message === "UNSUPPORTED_FILE_TYPE") {
        return res.status(400).json({
          error: { code: "UNSUPPORTED_FILE_TYPE", message: "Use an image for the group photo." },
        });
      }
      next(error);
    });
  },
  async (req, res, next) => {
    try {
      const conversation = await Conversation.findOne({
        _id: req.params.conversationId,
        participantIds: req.user._id,
        isGroup: true,
      });

      if (!conversation) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Group not found." },
        });
      }
      if (!isGroupAdmin(conversation, req.user._id)) {
        return res.status(403).json({
          error: { code: "FORBIDDEN", message: "Only a group admin can do that." },
        });
      }
      if (!req.file || !req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({
          error: { code: "INVALID_FILE", message: "Choose an image for the group photo." },
        });
      }

      const previousPublicId = conversation.groupAvatar?.publicId;
      const result = await uploadBuffer(req.file.buffer, {
        kind: "image",
        folder: "kotha-bartha/group-avatars",
      });
      conversation.groupAvatar = { publicId: result.public_id, secureUrl: result.secure_url };
      await conversation.save();
      if (previousPublicId) destroyAsset(previousPublicId, "image");

      const others = otherParticipants(conversation, req.user._id);
      broadcastToOthers(req, others, "conversation:updated", {
        id: conversation._id.toString(),
        ...groupSummary(conversation),
      });

      res.json({ data: { id: conversation._id.toString(), ...groupSummary(conversation) } });
    } catch (error) {
      next(error);
    }
  },
);

router.post("/conversations/:conversationId/members", async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      participantIds: req.user._id,
      isGroup: true,
    });

    if (!conversation) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Group not found." },
      });
    }
    if (!isGroupAdmin(conversation, req.user._id)) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "Only a group admin can add members." },
      });
    }

    const memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];
    const existing = new Set(conversation.participantIds.map((id) => id.toString()));
    const newIds = [...new Set(memberIds)].filter(
      (id) => mongoose.isValidObjectId(id) && !existing.has(id),
    );
    if (!newIds.length) {
      return res.status(400).json({
        error: { code: "INVALID_GROUP", message: "No new members to add." },
      });
    }

    const users = await User.find({ _id: { $in: newIds } }).select("_id");
    conversation.participantIds.push(...users.map((user) => user._id));
    await conversation.save();

    const others = otherParticipants(conversation, req.user._id);
    broadcastToOthers(req, others, "conversation:updated", {
      id: conversation._id.toString(),
      ...groupSummary(conversation),
    });

    res.json({ data: { id: conversation._id.toString(), ...groupSummary(conversation) } });
  } catch (error) {
    next(error);
  }
});

router.delete(
  "/conversations/:conversationId/members/:userId",
  async (req, res, next) => {
    try {
      const conversation = await Conversation.findOne({
        _id: req.params.conversationId,
        participantIds: req.user._id,
        isGroup: true,
      });

      if (!conversation) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Group not found." },
        });
      }

      const isSelf = req.params.userId === req.user._id.toString();
      if (!isSelf && !isGroupAdmin(conversation, req.user._id)) {
        return res.status(403).json({
          error: { code: "FORBIDDEN", message: "Only a group admin can remove members." },
        });
      }
      if (!isSelf && isGroupAdmin(conversation, req.params.userId)) {
        return res.status(403).json({
          error: { code: "FORBIDDEN", message: "An admin can't remove another admin." },
        });
      }

      conversation.participantIds = conversation.participantIds.filter(
        (id) => id.toString() !== req.params.userId,
      );
      conversation.adminIds = (conversation.adminIds || []).filter(
        (id) => id.toString() !== req.params.userId,
      );

      // A group can't be left with zero admins — promote whoever's been
      // there longest (first in the remaining list) so it stays moderatable.
      if (!conversation.adminIds.length && conversation.participantIds.length) {
        conversation.adminIds = [conversation.participantIds[0]];
      }

      await conversation.save();

      const others = otherParticipants(conversation, req.user._id);
      broadcastToOthers(req, [...others, req.params.userId], "conversation:updated", {
        id: conversation._id.toString(),
        ...groupSummary(conversation),
      });

      res.json({ data: { id: conversation._id.toString(), ...groupSummary(conversation) } });
    } catch (error) {
      next(error);
    }
  },
);

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

    const otherIds = visibleConversations
      .filter((conversation) => !conversation.isGroup)
      .map((conversation) => otherParticipants(conversation, req.user._id)[0]);

    const users = await User.find({
      _id: {
        $in: otherIds,
      },
    });

    const byId = new Map(users.map((user) => [user._id.toString(), user]));

    res.json({
      data: visibleConversations.map((conversation) => {
        if (conversation.isGroup) {
          return {
            id: conversation._id,
            isGroup: true,
            group: groupSummary(conversation),
            lastMessage: conversation.lastMessage,
            lastMessageAt: conversation.lastMessageAt,
            unreadCount: conversation.unreadCounts?.get?.(userId) || 0,
          };
        }

        const other = byId.get(otherParticipants(conversation, req.user._id)[0]?.toString());

        return {
          id: conversation._id,
          isGroup: false,
          user: other ? { ...safeUser(other), isOnline: isOnline(other._id) } : null,
          lastMessage: conversation.lastMessage,
          lastMessageAt: conversation.lastMessageAt,
          unreadCount: conversation.unreadCounts?.get?.(userId) || 0,
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

      if (!conversation) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Conversation not found." },
        });
      }

      const userId = req.user._id.toString();
      const deletedAt = conversation?.deletedAtBy?.get?.(userId);

      const unreadMessages = await Message.find({
        conversationId: conversation._id,
        senderId: { $ne: req.user._id },
        ...(deletedAt ? { createdAt: { $gt: deletedAt } } : {}),
        status: { $ne: "read" },
        deletedAt: null,
      })
        .select("_id senderId")
        .lean();

      await Message.updateMany(
        {
          conversationId: conversation._id,
          senderId: { $ne: req.user._id },
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
        .populate("senderId", "fullName avatar")
        .populate("mentions", "fullName")
        .sort({
          createdAt: 1,
        })
        .lean();

      res.json({
        data: messages.map((message) => ({
          id: message._id.toString(),
          body: message.body,
          type: message.type || "text",
          call: message.call
            ? {
                outcome: message.call.outcome,
                durationSec: message.call.durationSec || 0,
              }
            : null,
          attachment: message.attachment || null,
          mentions: (message.mentions || []).map((mention) => ({
            id: mention._id.toString(),
            fullName: mention.fullName,
          })),
          createdAt: message.createdAt,
          senderId: message.senderId._id.toString(),
          sender: {
            id: message.senderId._id.toString(),
            fullName: message.senderId.fullName,
            avatar: message.senderId.avatar,
          },
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

      if (!conversation || !body) {
        return res.status(400).json({
          error: {
            code: "INVALID_MESSAGE",
            message: "Message cannot be empty.",
          },
        });
      }

      const others = otherParticipants(conversation, req.user._id);

      if (await isBlockedForSend(conversation, req.user._id, others)) {
        return res.status(403).json({
          error: {
            code: "BLOCKED",
            message: "You can't message this user.",
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

      // Mentions: only ids the client explicitly picked from the
      // suggestion UI, and only if they're actually in this conversation —
      // never inferred from parsing the text server-side.
      const participantSet = new Set(conversation.participantIds.map((id) => id.toString()));
      const mentionIds = Array.isArray(req.body.mentions)
        ? [...new Set(req.body.mentions)].filter(
            (id) => mongoose.isValidObjectId(id) && participantSet.has(id),
          )
        : [];
      const mentionUsers = mentionIds.length
        ? await User.find({ _id: { $in: mentionIds } }).select("fullName")
        : [];
      const mentions = mentionUsers.map((mentionUser) => ({
        id: mentionUser._id.toString(),
        fullName: mentionUser.fullName,
      }));

      clearHiddenFor(conversation, [req.user._id, ...others]);

      const message = await Message.create({
        conversationId: conversation._id,
        senderId: req.user._id,
        recipientId: conversation.isGroup ? null : others[0],
        body,
        mentions: mentionIds,
        replyTo: replyTo?._id || null,
        status: "delivered",
      });

      conversation.lastMessage = body;
      conversation.lastMessageAt = message.createdAt;
      bumpUnreadFor(conversation, others);
      await conversation.save();

      const payload = {
        id: message._id.toString(),
        conversationId: conversation._id.toString(),
        body: message.body,
        mentions,
        createdAt: message.createdAt,
        senderId: req.user._id.toString(),
        sender: {
          id: req.user._id.toString(),
          fullName: req.user.fullName,
          avatar: req.user.avatar,
        },
      };
      broadcastToOthers(req, others, "message:new", payload);

      res.status(201).json({
        data: {
          ...payload,
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
// CALL RECORD
//
// Created once per call by the caller's client after it ends (completed,
// missed, or cancelled) — the only backend awareness of calls beyond the
// existing raw call:signal WebRTC relay. Rendered as a distinct message
// type on the client, same delivery path as a normal text message.
// (Audio calls stay 1-to-1 — this route is unreachable for groups since
// the client only ever offers the call button in a 1-to-1 thread.)
// ============================================================

const formatCallDuration = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

router.post("/conversations/:conversationId/calls", async (req, res, next) => {
  try {
    const outcome = String(req.body.outcome || "");
    const durationSec = Math.max(0, Math.round(Number(req.body.durationSec) || 0));

    if (!["completed", "missed", "cancelled"].includes(outcome)) {
      return res.status(400).json({
        error: { code: "INVALID_CALL", message: "Invalid call outcome." },
      });
    }

    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      participantIds: req.user._id,
      isGroup: { $ne: true },
    });

    if (!conversation) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Conversation not found." },
      });
    }

    const recipientId = otherParticipants(conversation, req.user._id)[0];

    if (await isBlockedEitherWay(req.user._id, recipientId)) {
      return res.status(403).json({
        error: { code: "BLOCKED", message: "You can't call this user." },
      });
    }

    const body =
      outcome === "completed"
        ? `Audio call · ${formatCallDuration(durationSec)}`
        : "Missed audio call";

    clearHiddenFor(conversation, [req.user._id, recipientId]);

    const message = await Message.create({
      conversationId: conversation._id,
      senderId: req.user._id,
      recipientId,
      body,
      type: "call",
      call: { outcome, durationSec: outcome === "completed" ? durationSec : 0 },
      status: "delivered",
    });

    conversation.lastMessage = body;
    conversation.lastMessageAt = message.createdAt;
    bumpUnreadFor(conversation, [recipientId]);
    await conversation.save();

    const payload = {
      id: message._id.toString(),
      conversationId: conversation._id.toString(),
      body: message.body,
      type: "call",
      call: { outcome, durationSec: message.call.durationSec || 0 },
      createdAt: message.createdAt,
      senderId: req.user._id.toString(),
      sender: { id: req.user._id.toString(), fullName: req.user.fullName, avatar: req.user.avatar },
    };

    emitToUser(req, recipientId, "message:new", payload);

    res.status(201).json({
      data: {
        ...payload,
        status: message.status,
        replyTo: null,
        reactions: [],
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// ATTACHMENTS (images, files, voice messages)
//
// A single multipart request: uploads the file to Cloudinary and creates
// the message in one step (unlike calls, there's no separate client-side
// report — the sender's own POST is the one and only write).
// ============================================================

const attachmentLabel = (kind, fileName) => {
  if (kind === "image") return "📷 Photo";
  if (kind === "voice") return "🎤 Voice message";
  return `📎 ${fileName}`.slice(0, 120);
};

router.post(
  "/conversations/:conversationId/attachments",
  (req, res, next) => {
    upload.single("file")(req, res, (error) => {
      if (!error) return next();
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          error: { code: "FILE_TOO_LARGE", message: "File is larger than 15MB." },
        });
      }
      if (error.message === "UNSUPPORTED_FILE_TYPE") {
        return res.status(400).json({
          error: { code: "UNSUPPORTED_FILE_TYPE", message: "That file type isn't supported." },
        });
      }
      next(error);
    });
  },
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: { code: "NO_FILE", message: "No file was attached." },
        });
      }

      const conversation = await Conversation.findOne({
        _id: req.params.conversationId,
        participantIds: req.user._id,
      });

      if (!conversation) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Conversation not found." },
        });
      }

      const others = otherParticipants(conversation, req.user._id);

      if (await isBlockedForSend(conversation, req.user._id, others)) {
        return res.status(403).json({
          error: { code: "BLOCKED", message: "You can't message this user." },
        });
      }

      const kind = attachmentKindFor(req.file.mimetype);
      const durationSec =
        kind === "voice" ? Math.max(0, Math.round(Number(req.body.durationSec) || 0)) : undefined;
      const fileName = String(req.file.originalname || "file").slice(0, 200);

      let uploadResult;
      try {
        uploadResult = await uploadBuffer(req.file.buffer, {
          kind,
          folder: "kotha-bartha/messages",
        });
      } catch {
        return res.status(502).json({
          error: { code: "UPLOAD_FAILED", message: "Upload failed. Please try again." },
        });
      }

      const attachment = {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        fileName,
        mimeType: req.file.mimetype,
        size: req.file.size,
        kind,
        durationSec,
      };
      const body = attachmentLabel(kind, fileName);

      clearHiddenFor(conversation, [req.user._id, ...others]);

      const message = await Message.create({
        conversationId: conversation._id,
        senderId: req.user._id,
        recipientId: conversation.isGroup ? null : others[0],
        body,
        type: "attachment",
        attachment,
        status: "delivered",
      });

      conversation.lastMessage = body;
      conversation.lastMessageAt = message.createdAt;
      bumpUnreadFor(conversation, others);
      await conversation.save();

      const payload = {
        id: message._id.toString(),
        conversationId: conversation._id.toString(),
        body: message.body,
        type: "attachment",
        attachment,
        createdAt: message.createdAt,
        senderId: req.user._id.toString(),
        sender: { id: req.user._id.toString(), fullName: req.user.fullName, avatar: req.user.avatar },
      };

      broadcastToOthers(req, others, "message:new", payload);

      res.status(201).json({
        data: {
          ...payload,
          status: message.status,
          replyTo: null,
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
      broadcastToOthers(req, otherParticipants(conversation, req.user._id), "message:reaction", payload);

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

      if (message.type !== "text") {
        return res.status(400).json({
          error: {
            code: "INVALID_MESSAGE",
            message: "This message can't be edited.",
          },
        });
      }

      message.body = body;

      message.editedAt = new Date();

      await message.save();

      // Realtime update
      broadcastToOthers(req, otherParticipants(conversation, req.user._id), "message:updated", {
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
      if (message.attachment?.publicId) {
        destroyAsset(message.attachment.publicId, message.attachment.kind);
      }

      const others = otherParticipants(conversation, req.user._id);

      // Realtime delete
      broadcastToOthers(req, others, "message:deleted", {
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

module.exports = router;
