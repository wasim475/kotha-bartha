const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const Friendship = require("../models/Friendship");
const FriendRequest = require("../models/FriendRequest");
const { pairKey } = require("../utils/ids");
const { safeUser } = require("../utils/serializers");
const { emitToUser } = require("../utils/realtime");
const { createNotification } = require("../services/notification.service");

const router = express.Router();

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

module.exports = router;
