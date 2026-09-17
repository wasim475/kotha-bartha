const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const Post = require("../models/Post");
const Friendship = require("../models/Friendship");
const FriendRequest = require("../models/FriendRequest");
const { safeUser, serializePost } = require("../utils/serializers");

const router = express.Router();

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

module.exports = router;
