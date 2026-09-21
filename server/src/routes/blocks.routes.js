const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const Block = require("../models/Block");
const Friendship = require("../models/Friendship");
const FriendRequest = require("../models/FriendRequest");
const { pairKey } = require("../utils/ids");
const { safeUser } = require("../utils/serializers");

const router = express.Router();

// ============================================================
// LIST BLOCKED USERS
// ============================================================
router.get("/blocks", async (req, res, next) => {
  try {
    const blocks = await Block.find({ blockerId: req.user._id })
      .populate("blockedId")
      .sort({ createdAt: -1 });

    const data = blocks
      .filter((block) => block.blockedId)
      .map((block) => safeUser(block.blockedId));

    res.json({
      data,
      meta: { count: data.length },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// BLOCK A USER
// ============================================================
router.post("/blocks/:userId", async (req, res, next) => {
  try {
    if (
      !mongoose.isValidObjectId(req.params.userId) ||
      req.params.userId === req.user._id.toString()
    ) {
      return res.status(400).json({
        error: { code: "INVALID_REQUEST", message: "Invalid user." },
      });
    }

    const target = await User.findById(req.params.userId);
    if (!target) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "User not found." },
      });
    }

    await Block.findOneAndUpdate(
      { blockerId: req.user._id, blockedId: target._id },
      { $setOnInsert: { blockerId: req.user._id, blockedId: target._id } },
      { upsert: true, setDefaultsOnInsert: true },
    );

    // A block is a hard reset of the relationship: any existing friendship
    // and any pending request between the pair (either direction) end too,
    // not just future contact.
    await Friendship.deleteOne({
      pairKey: pairKey(req.user._id, target._id),
    });
    await FriendRequest.deleteMany({
      status: "pending",
      $or: [
        { senderId: req.user._id, receiverId: target._id },
        { senderId: target._id, receiverId: req.user._id },
      ],
    });

    res.status(201).json({ data: { blocked: true } });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// UNBLOCK A USER
// ============================================================
router.delete("/blocks/:userId", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({
        error: { code: "INVALID_REQUEST", message: "Invalid user." },
      });
    }

    const result = await Block.findOneAndDelete({
      blockerId: req.user._id,
      blockedId: req.params.userId,
    });

    if (!result) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "You haven't blocked this user." },
      });
    }

    res.json({ data: { blocked: false } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
