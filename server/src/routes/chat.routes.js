const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Block = require("../models/Block");
const { pairKey } = require("../utils/ids");
const { safeUser } = require("../utils/serializers");
const { emitToUser } = require("../utils/realtime");
const { isBlockedEitherWay } = require("../utils/blocks");
const { isOnline } = require("../utils/presence");
const { upload, attachmentKindFor } = require("../middleware/upload");
const { uploadBuffer, destroyAsset } = require("../utils/cloudinary");
const { UNSEND_WINDOW_MS } = require("../utils/config");
const { THEME_IDS } = require("../utils/conversationThemes");

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

// Directional block lookups for `userId`, batched into two queries instead
// of one per conversation — used to annotate a 1-to-1 conversation's other
// participant with `isBlocked`/`hasBlockedMe` for the client (chat header
// menu, composer disabled state). Reuses the same Block model the existing
// global block system (blocks.routes.js) already writes to.
const blockSets = async (userId) => {
  const [blockedByMe, blockedMe] = await Promise.all([
    Block.find({ blockerId: userId }).select("blockedId").lean(),
    Block.find({ blockedId: userId }).select("blockerId").lean(),
  ]);
  return {
    blockedByMe: new Set(blockedByMe.map((block) => block.blockedId.toString())),
    blockedMe: new Set(blockedMe.map((block) => block.blockerId.toString())),
  };
};

// Shared shape for the "other participant" of a 1-to-1 conversation, as
// seen by `userId` — their nickname for that person (private, only ever set
// by `userId` themself), the block status in both directions, and every
// public key they've published across all their devices (see
// User.getPublicKeys() — includes their legacy single-device key too, if
// any, so old conversations keep decrypting).
const otherParticipantView = (conversation, other, userId, blocks) => ({
  ...safeUser(other),
  isOnline: isOnline(other._id),
  publicKeys: other.getPublicKeys ? other.getPublicKeys() : [],
  nickname: conversation.nicknames?.get?.(userId) || null,
  isBlocked: blocks.blockedByMe.has(other._id.toString()),
  hasBlockedMe: blocks.blockedMe.has(other._id.toString()),
});

const groupSummary = (conversation) => ({
  id: conversation._id.toString(),
  name: conversation.groupName,
  avatar: conversation.groupAvatar,
  memberCount: conversation.participantIds.length,
  adminIds: (conversation.adminIds || []).map((id) => id.toString()),
  pinnedMessages: (conversation.pinnedMessages || []).map((pin) => ({
    messageId: pin.messageId.toString(),
    pinnedBy: pin.pinnedBy.toString(),
    pinnedAt: pin.pinnedAt,
  })),
});

const isGroupAdmin = (conversation, userId) =>
  (conversation.adminIds || []).some((id) => id.toString() === userId.toString());

const unsendExpiresAt = (message) =>
  new Date(new Date(message.createdAt).getTime() + UNSEND_WINDOW_MS);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Shared shape for a message's encrypted-or-plaintext content, used by every
// route that returns a message so the client always sees the same fields.
// Handles both the current multi-device format (one ciphertext per target
// deviceId, plus the sending device's own public key) and the legacy
// single-shared-key format older messages were stored in — never both at
// once on the same message, so the client can tell which one it's looking
// at just from which field is populated.
const contentFields = (message) =>
  message.encrypted
    ? {
        encrypted: true,
        encryptedBody: message.encryptedPayloads?.length
          ? null
          : {
              ciphertext: message.encryptedBody?.ciphertext || "",
              iv: message.encryptedBody?.iv || "",
            },
        encryptedPayloads: message.encryptedPayloads?.length
          ? message.encryptedPayloads.map((payload) => ({
              deviceId: payload.deviceId,
              ciphertext: payload.ciphertext,
              iv: payload.iv,
            }))
          : null,
        senderPublicKey: message.senderPublicKey || null,
        body: message.body,
      }
    : { encrypted: false, encryptedBody: null, encryptedPayloads: null, senderPublicKey: null, body: message.body };

const MAX_CIPHERTEXT_LENGTH = 20000;
const MAX_DEVICE_TARGETS = 20;

const validEncryptedPayloads = (payloads) =>
  Array.isArray(payloads) &&
  payloads.length > 0 &&
  payloads.length <= MAX_DEVICE_TARGETS &&
  payloads.every(
    (payload) =>
      payload &&
      typeof payload.deviceId === "string" &&
      payload.deviceId.length > 0 &&
      payload.deviceId.length <= 100 &&
      typeof payload.ciphertext === "string" &&
      payload.ciphertext.length > 0 &&
      payload.ciphertext.length <= MAX_CIPHERTEXT_LENGTH &&
      typeof payload.iv === "string" &&
      payload.iv.length > 0,
  );

// Normalizes an incoming encrypted-or-plaintext message body from the
// client into one shape, accepting both the legacy single-shared-key
// format (one top-level ciphertext/iv) and the current multi-device format
// (one ciphertext/iv per target device, plus the sending device's own
// public key) — see client/src/utility/crypto.js's encryptForDevices for
// how the client builds the latter.
const parseIncomingContent = (payload) => {
  const legacyEncrypted =
    payload.encrypted === true &&
    typeof payload.ciphertext === "string" &&
    typeof payload.iv === "string";
  const multiDeviceEncrypted =
    payload.encrypted === true &&
    !legacyEncrypted &&
    validEncryptedPayloads(payload.encryptedPayloads) &&
    typeof payload.senderPublicKey === "string" &&
    payload.senderPublicKey.length > 0 &&
    payload.senderPublicKey.length <= 2000;
  const isEncrypted = legacyEncrypted || multiDeviceEncrypted;

  return {
    isEncrypted,
    valid: !payload.encrypted || legacyEncrypted || multiDeviceEncrypted,
    oversized: legacyEncrypted && payload.ciphertext.length > MAX_CIPHERTEXT_LENGTH,
    body: isEncrypted ? "🔒 Encrypted message" : String(payload.body || "").trim(),
    encryptedBody: legacyEncrypted ? { ciphertext: payload.ciphertext, iv: payload.iv } : undefined,
    encryptedPayloads: multiDeviceEncrypted
      ? payload.encryptedPayloads.map((entry) => ({
          deviceId: String(entry.deviceId).slice(0, 100),
          ciphertext: String(entry.ciphertext).slice(0, MAX_CIPHERTEXT_LENGTH),
          iv: String(entry.iv).slice(0, 64),
        }))
      : undefined,
    senderPublicKey: multiDeviceEncrypted ? payload.senderPublicKey : undefined,
  };
};

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
      const blocks = await blockSets(req.user._id);
      return res.json({
        data: {
          id: conversation._id.toString(),
          isGroup: false,
          theme: conversation.theme || "default",
        likeEmoji: conversation.likeEmoji || "👍",
          user: other
            ? otherParticipantView(conversation, other, req.user._id.toString(), blocks)
            : null,
        },
      });
    }

    const members = await User.find({ _id: { $in: conversation.participantIds } });

    const pinnedIds = (conversation.pinnedMessages || []).map((pin) => pin.messageId);
    const pinnedDocs = pinnedIds.length
      ? await Message.find({ _id: { $in: pinnedIds }, deletedAt: null })
          .populate("senderId", "fullName")
          .lean()
      : [];
    const pinnedById = new Map(pinnedDocs.map((doc) => [doc._id.toString(), doc]));
    const pinnedMessagesDetail = (conversation.pinnedMessages || [])
      .map((pin) => {
        const doc = pinnedById.get(pin.messageId.toString());
        if (!doc) return null;
        return {
          id: doc._id.toString(),
          body: doc.encrypted ? "🔒 Encrypted message" : doc.body,
          type: doc.type || "text",
          senderId: doc.senderId._id.toString(),
          senderName: doc.senderId.fullName,
          pinnedBy: pin.pinnedBy.toString(),
          pinnedAt: pin.pinnedAt,
        };
      })
      .filter(Boolean);

    res.json({
      data: {
        id: conversation._id.toString(),
        isGroup: true,
        theme: conversation.theme || "default",
        likeEmoji: conversation.likeEmoji || "👍",
        ...groupSummary(conversation),
        pinnedMessagesDetail,
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
    const wantArchived = req.query.archived === "true";
    const conversations = await Conversation.find({
      participantIds: req.user._id,
    })
      .sort({
        updatedAt: -1,
      })
      .limit(50);

    const visibleConversations = conversations.filter((conversation) => {
      const isArchived = conversation.archivedFor?.some((id) => id.toString() === userId);
      if (Boolean(isArchived) !== wantArchived) return false;

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
    const blocks = await blockSets(req.user._id);

    res.json({
      data: visibleConversations.map((conversation) => {
        if (conversation.isGroup) {
          return {
            id: conversation._id,
            isGroup: true,
            theme: conversation.theme || "default",
        likeEmoji: conversation.likeEmoji || "👍",
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
          theme: conversation.theme || "default",
        likeEmoji: conversation.likeEmoji || "👍",
          user: other ? otherParticipantView(conversation, other, userId, blocks) : null,
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
// ARCHIVE / UNARCHIVE CONVERSATION (per-user; never affects the
// other participant's own list)
// ============================================================

router.post("/conversations/:conversationId/archive", async (req, res, next) => {
  try {
    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.conversationId, participantIds: req.user._id },
      { $addToSet: { archivedFor: req.user._id } },
      { new: true },
    );

    if (!conversation) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Conversation not found." },
      });
    }

    res.json({ data: { id: conversation._id.toString(), archived: true } });
  } catch (error) {
    next(error);
  }
});

router.post("/conversations/:conversationId/unarchive", async (req, res, next) => {
  try {
    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.conversationId, participantIds: req.user._id },
      { $pull: { archivedFor: req.user._id } },
      { new: true },
    );

    if (!conversation) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Conversation not found." },
      });
    }

    res.json({ data: { id: conversation._id.toString(), archived: false } });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// NICKNAME — 1-to-1 only. Private per-setter label for the other
// participant, stored on the conversation itself (not the User doc), so it
// never touches the other person's real profile name and is never visible
// to anyone but the person who set it.
// ============================================================

router.patch("/conversations/:conversationId/nickname", async (req, res, next) => {
  try {
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

    const nickname = String(req.body.nickname || "").trim().slice(0, 40);
    const userId = req.user._id.toString();

    conversation.nicknames = conversation.nicknames || new Map();
    if (nickname) conversation.nicknames.set(userId, nickname);
    else conversation.nicknames.delete(userId);

    await conversation.save();

    res.json({ data: { id: conversation._id.toString(), nickname: nickname || null } });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// CONVERSATION THEME — a single shared value per conversation (unlike
// nicknames), synced to every other participant over the same socket
// channel used for message delivery.
// ============================================================

router.patch("/conversations/:conversationId/theme", async (req, res, next) => {
  try {
    const theme = String(req.body.theme || "");
    if (!THEME_IDS.includes(theme)) {
      return res.status(400).json({
        error: { code: "INVALID_THEME", message: "Invalid conversation theme." },
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

    conversation.theme = theme;
    await conversation.save();

    const others = otherParticipants(conversation, req.user._id);
    broadcastToOthers(req, others, "conversation:theme", {
      id: conversation._id.toString(),
      theme,
    });

    res.json({ data: { id: conversation._id.toString(), theme } });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// CONVERSATION LIKE EMOJI — the emoji the composer's quick "Like" button
// sends in this conversation (see client MessageComposer.jsx). Shared for
// every participant, same sync model as CONVERSATION THEME above.
// ============================================================

router.patch("/conversations/:conversationId/like-emoji", async (req, res, next) => {
  try {
    const likeEmoji = String(req.body.likeEmoji || "").trim();
    if (!likeEmoji || likeEmoji.length > 8) {
      return res.status(400).json({
        error: { code: "INVALID_EMOJI", message: "Choose a single emoji." },
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

    conversation.likeEmoji = likeEmoji;
    await conversation.save();

    const others = otherParticipants(conversation, req.user._id);
    broadcastToOthers(req, others, "conversation:likeEmoji", {
      id: conversation._id.toString(),
      likeEmoji,
    });

    res.json({ data: { id: conversation._id.toString(), likeEmoji } });
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
        deletedFor: { $ne: req.user._id },
      })
        .select("_id senderId")
        .sort({ createdAt: 1 })
        .lean();

      const firstUnreadMessageId = unreadMessages[0]?._id.toString() || null;

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
      conversation.unreadCounts?.set(userId, 0);
      conversation.lastReadAt?.set(userId, new Date());

      await conversation.save();

      const messages = await Message.find({
        conversationId: conversation._id,
        ...(deletedAt ? { createdAt: { $gt: deletedAt } } : {}),
        deletedAt: null,
        deletedFor: { $ne: req.user._id },
      })
        .populate("replyTo", "body senderId encrypted encryptedBody encryptedPayloads senderPublicKey")
        .populate("senderId", "fullName avatar")
        .populate("mentions", "fullName")
        .sort({
          createdAt: 1,
        })
        .lean();

      res.json({
        data: messages.map((message) => ({
          id: message._id.toString(),
          ...contentFields(message),
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
          unsendExpiresAt: unsendExpiresAt(message),
          forwardedFrom: message.forwardedFrom?.originalMessageId
            ? {
                originalMessageId: message.forwardedFrom.originalMessageId.toString(),
                originalSenderId: message.forwardedFrom.originalSenderId?.toString() || null,
              }
            : null,
          replyTo: message.replyTo
            ? {
                id: message.replyTo._id.toString(),
                ...contentFields(message.replyTo),
                senderId: message.replyTo.senderId.toString(),
              }
            : null,
          reactions: (message.reactions || []).map((reaction) => ({
            userId: reaction.userId.toString(),
            emoji: reaction.emoji,
          })),
          storyContext: message.storyContext?.refId
            ? {
                refType: message.storyContext.refType,
                refId: message.storyContext.refId.toString(),
                action: message.storyContext.action,
                reactionEmoji: message.storyContext.reactionEmoji || null,
                authorId: message.storyContext.authorId?.toString() || null,
                expiresAt: message.storyContext.expiresAt,
                snapshot: message.storyContext.snapshot || null,
              }
            : null,
        })),
        meta: { firstUnreadMessageId },
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
      // E2E encryption is opportunistic and 1-to-1 only — a group message
      // is always plaintext (mentions/search depend on the server reading
      // `body`), and a 1-to-1 message stays plaintext until both clients
      // have published a public key and the sender's client chooses to
      // encrypt. The server never sees the plaintext of an encrypted send.
      // Accepts either the legacy single-shared-key format or the current
      // multi-device format — see parseIncomingContent above.
      const parsed = parseIncomingContent(req.body);
      const isEncrypted = parsed.isEncrypted;
      const body = parsed.body;

      if (!parsed.valid || parsed.oversized) {
        return res.status(400).json({
          error: { code: "INVALID_MESSAGE", message: "Invalid encrypted message." },
        });
      }

      const conversation = await Conversation.findOne({
        _id: req.params.conversationId,
        participantIds: req.user._id,
      });

      if (!conversation || (isEncrypted && conversation.isGroup)) {
        return res.status(400).json({
          error: {
            code: "INVALID_MESSAGE",
            message: "Message cannot be empty.",
          },
        });
      }
      if (!isEncrypted && !body) {
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
        encrypted: isEncrypted,
        encryptedBody: parsed.encryptedBody,
        encryptedPayloads: parsed.encryptedPayloads,
        senderPublicKey: parsed.senderPublicKey,
      });

      conversation.lastMessage = body;
      conversation.lastMessageAt = message.createdAt;
      bumpUnreadFor(conversation, others);
      await conversation.save();

      const payload = {
        id: message._id.toString(),
        conversationId: conversation._id.toString(),
        ...contentFields(message),
        mentions,
        createdAt: message.createdAt,
        senderId: req.user._id.toString(),
        sender: {
          id: req.user._id.toString(),
          fullName: req.user.fullName,
          avatar: req.user.avatar,
        },
        unsendExpiresAt: unsendExpiresAt(message),
        forwardedFrom: null,
        // Must be on the broadcast payload too, not just the HTTP response
        // — the recipient only ever sees this message via the socket event,
        // never the sender's own REST response.
        replyTo: replyTo
          ? {
              id: replyTo._id.toString(),
              ...contentFields(replyTo),
              senderId: replyTo.senderId.toString(),
            }
          : null,
      };
      broadcastToOthers(req, others, "message:new", payload);

      res.status(201).json({
        data: {
          ...payload,
          status: message.status,
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
      unsendExpiresAt: unsendExpiresAt(message),
      forwardedFrom: null,
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
        unsendExpiresAt: unsendExpiresAt(message),
        forwardedFrom: null,
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
      const parsed = parseIncomingContent(req.body);
      const isEncrypted = parsed.isEncrypted;
      const body = parsed.body;

      if (!parsed.valid || parsed.oversized) {
        return res.status(400).json({
          error: { code: "INVALID_MESSAGE", message: "Invalid encrypted message." },
        });
      }
      if (!isEncrypted && !body) {
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
      message.encrypted = isEncrypted;
      message.encryptedBody = parsed.encryptedBody;
      message.encryptedPayloads = parsed.encryptedPayloads;
      message.senderPublicKey = parsed.senderPublicKey;

      message.editedAt = new Date();

      await message.save();

      // Realtime update
      broadcastToOthers(req, otherParticipants(conversation, req.user._id), "message:updated", {
        id: message._id.toString(),
        conversationId: conversation._id.toString(),
        ...contentFields(message),
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
          ...contentFields(message),
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

      if (Date.now() > unsendExpiresAt(message).getTime()) {
        return res.status(403).json({
          error: {
            code: "UNSEND_EXPIRED",
            message: "This message can no longer be deleted for everyone.",
          },
        });
      }

      // Soft delete
      message.deletedAt = new Date();

      await message.save();
      if (message.attachment?.publicId) {
        // Don't destroy the Cloudinary asset if another (e.g. forwarded)
        // message still points at the same publicId.
        const stillReferenced = await Message.exists({
          "attachment.publicId": message.attachment.publicId,
          deletedAt: null,
          _id: { $ne: message._id },
        });
        if (!stillReferenced) {
          destroyAsset(message.attachment.publicId, message.attachment.kind);
        }
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

// ============================================================
// DELETE FOR ME
//
// Hides a message for the caller only — no time limit, no sender
// restriction (any participant can clear a message from their own view),
// and no realtime broadcast since it doesn't change what anyone else sees.
// ============================================================

router.post(
  "/conversations/:conversationId/messages/:messageId/delete-for-me",
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

      const message = await Message.findOneAndUpdate(
        { _id: req.params.messageId, conversationId: conversation._id },
        { $addToSet: { deletedFor: req.user._id } },
        { new: true },
      );

      if (!message) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Message not found." },
        });
      }

      res.json({ data: { id: message._id.toString(), deletedForMe: true } });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================================
// MESSAGE SEARCH
//
// Server-side regex search over a conversation's plaintext bodies. For an
// E2E-encrypted 1-to-1 conversation the server can't search ciphertext —
// the client falls back to filtering its already-loaded, locally-decrypted
// thread instead of calling this route.
// ============================================================

router.get(
  "/conversations/:conversationId/messages/search",
  async (req, res, next) => {
    try {
      const query = String(req.query.q || "").trim();
      if (!query) {
        return res.json({ data: [], meta: { hasMore: false } });
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

      const messages = await Message.find({
        conversationId: conversation._id,
        deletedAt: null,
        deletedFor: { $ne: req.user._id },
        encrypted: { $ne: true },
        body: { $regex: escapeRegExp(query), $options: "i" },
      })
        .populate("senderId", "fullName avatar")
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();

      res.json({
        data: messages.map((message) => ({
          id: message._id.toString(),
          body: message.body,
          type: message.type || "text",
          createdAt: message.createdAt,
          senderId: message.senderId._id.toString(),
          sender: { id: message.senderId._id.toString(), fullName: message.senderId.fullName },
        })),
        meta: { hasMore: false },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================================
// FORWARD MESSAGE
// ============================================================

router.post(
  "/conversations/:conversationId/messages/:messageId/forward",
  async (req, res, next) => {
    try {
      const sourceConversation = await Conversation.findOne({
        _id: req.params.conversationId,
        participantIds: req.user._id,
      });

      if (!sourceConversation) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Conversation not found." },
        });
      }

      const sourceMessage = await Message.findOne({
        _id: req.params.messageId,
        conversationId: sourceConversation._id,
        deletedAt: null,
        deletedFor: { $ne: req.user._id },
        type: { $ne: "call" },
      });

      if (!sourceMessage) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Message not found." },
        });
      }
      if (sourceMessage.encrypted) {
        return res.status(400).json({
          error: {
            code: "ENCRYPTED_MESSAGE",
            message: "Encrypted messages must be forwarded from the client after decrypting.",
          },
        });
      }

      const targetIds = Array.isArray(req.body.targetConversationIds)
        ? [...new Set(req.body.targetConversationIds)].filter((id) => mongoose.isValidObjectId(id))
        : [];

      if (!targetIds.length) {
        return res.status(400).json({
          error: { code: "INVALID_TARGET", message: "Choose at least one conversation to forward to." },
        });
      }

      const targetConversations = await Conversation.find({
        _id: { $in: targetIds },
        participantIds: req.user._id,
      });

      const results = [];
      for (const target of targetConversations) {
        const targetOthers = otherParticipants(target, req.user._id);
        if (await isBlockedForSend(target, req.user._id, targetOthers)) continue;

        clearHiddenFor(target, [req.user._id, ...targetOthers]);

        const forwarded = await Message.create({
          conversationId: target._id,
          senderId: req.user._id,
          recipientId: target.isGroup ? null : targetOthers[0],
          body: sourceMessage.body,
          type: sourceMessage.type,
          attachment: sourceMessage.attachment,
          status: "delivered",
          forwardedFrom: {
            originalMessageId: sourceMessage._id,
            originalSenderId: sourceMessage.senderId,
          },
        });

        target.lastMessage = forwarded.body;
        target.lastMessageAt = forwarded.createdAt;
        bumpUnreadFor(target, targetOthers);
        await target.save();

        const payload = {
          id: forwarded._id.toString(),
          conversationId: target._id.toString(),
          ...contentFields(forwarded),
          type: forwarded.type,
          attachment: forwarded.attachment || null,
          createdAt: forwarded.createdAt,
          senderId: req.user._id.toString(),
          sender: { id: req.user._id.toString(), fullName: req.user.fullName, avatar: req.user.avatar },
          unsendExpiresAt: unsendExpiresAt(forwarded),
          forwardedFrom: {
            originalMessageId: sourceMessage._id.toString(),
            originalSenderId: sourceMessage.senderId.toString(),
          },
        };
        broadcastToOthers(req, targetOthers, "message:new", payload);
        results.push(payload);
      }

      res.status(201).json({ data: results });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================================
// PIN / UNPIN MESSAGE — GROUP CHATS ONLY
// ============================================================

const setPinned = (pinned) => async (req, res, next) => {
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

    conversation.pinnedMessages = conversation.pinnedMessages || [];
    conversation.pinnedMessages = conversation.pinnedMessages.filter(
      (pin) => pin.messageId.toString() !== message._id.toString(),
    );
    if (pinned) {
      conversation.pinnedMessages.push({
        messageId: message._id,
        pinnedBy: req.user._id,
        pinnedAt: new Date(),
      });
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
};

router.post("/conversations/:conversationId/messages/:messageId/pin", setPinned(true));
router.delete("/conversations/:conversationId/messages/:messageId/pin", setPinned(false));

module.exports = router;
