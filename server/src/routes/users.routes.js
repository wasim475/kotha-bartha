const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const Post = require("../models/Post");
const Friendship = require("../models/Friendship");
const FriendRequest = require("../models/FriendRequest");
const Block = require("../models/Block");
const { safeUser, serializePost } = require("../utils/serializers");
const { blockedPairIds } = require("../utils/blocks");
const { upload } = require("../middleware/upload");
const { uploadBuffer, destroyAsset } = require("../utils/cloudinary");

const router = express.Router();

// Posts/photos are only visible to the owner and their friends — there's
// no post-level privacy setting in this app, so profile visibility is
// simply keyed off the existing friendship relationship.
const canViewProfileContent = async (viewerId, profileUserId) => {
  if (viewerId.toString() === profileUserId.toString()) return true;
  return Boolean(
    await Friendship.exists({ userIds: { $all: [viewerId, profileUserId] } }),
  );
};

router.get("/users", async (req, res, next) => {
  try {
    const excludedIds = await blockedPairIds(req.user._id);

    const users = await User.find({
      _id: {
        $ne: req.user._id,
        $nin: [...excludedIds],
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

    const excludedIds = await blockedPairIds(req.user._id);

    const users = await User.find({
      _id: {
        $ne: req.user._id,
        $nin: [...excludedIds],
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

    if (typeof req.body.hometown === "string") {
      updates.hometown = req.body.hometown.trim().slice(0, 80);
    }

    if (typeof req.body.currentCity === "string") {
      updates.currentCity = req.body.currentCity.trim().slice(0, 80);
    }

    if ("dateOfBirth" in req.body) {
      if (!req.body.dateOfBirth) {
        updates.dateOfBirth = null;
      } else {
        const parsed = new Date(req.body.dateOfBirth);
        if (Number.isNaN(parsed.getTime()) || parsed > new Date()) {
          return res.status(400).json({
            error: { code: "INVALID_DATE", message: "Invalid date of birth." },
          });
        }
        updates.dateOfBirth = parsed;
      }
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
// UPDATE MY AVATAR / COVER PHOTO
// ============================================================

const uploadProfileImage = (field, folder) => [
  (req, res, next) => {
    upload.single("file")(req, res, (error) => {
      if (!error) return next();
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          error: { code: "FILE_TOO_LARGE", message: "Image is larger than 15MB." },
        });
      }
      return res.status(400).json({
        error: { code: "UNSUPPORTED_FILE_TYPE", message: "Choose an image file." },
      });
    });
  },
  async (req, res, next) => {
    try {
      if (!req.file || !req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({
          error: { code: "INVALID_FILE", message: "Choose an image file." },
        });
      }

      const previous = req.user[field]?.publicId;
      const result = await uploadBuffer(req.file.buffer, { kind: "image", folder });

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: { [field]: { publicId: result.public_id, secureUrl: result.secure_url } } },
        { new: true },
      );

      if (previous) destroyAsset(previous, "image");

      res.json({ data: user.toSafeJSON() });
    } catch (error) {
      next(error);
    }
  },
];

// ============================================================
// E2E ENCRYPTION PUBLIC KEY
//
// Publishes this device's ECDH public key (JWK JSON) so other users'
// clients can derive a shared key for encrypting 1-to-1 messages to this
// user. The matching private key is generated and kept client-side only —
// it is never sent here or stored on the server.
// ============================================================
router.patch("/users/me/public-key", async (req, res, next) => {
  try {
    const publicKey = String(req.body.publicKey || "").trim();

    if (!publicKey || publicKey.length > 2000) {
      return res.status(400).json({
        error: { code: "INVALID_KEY", message: "Invalid public key." },
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { publicKey } },
      { new: true },
    );

    res.json({ data: { publicKey: user.publicKey } });
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/users/me/avatar",
  ...uploadProfileImage("avatar", "kotha-bartha/avatars"),
);

router.patch(
  "/users/me/cover",
  ...uploadProfileImage("cover", "kotha-bartha/covers"),
);

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

    const isBlocked = await Block.exists({
      blockerId: req.user._id,
      blockedId: user._id,
    });

    const hasBlockedMe = await Block.exists({
      blockerId: user._id,
      blockedId: req.user._id,
    });

    res.json({
      data: {
        ...safeUser(user),
        friendCount,
        isFriend: Boolean(friendship),
        friendRequestSent: Boolean(sentRequest),
        friendRequestReceived: Boolean(receivedRequest),
        receivedFriendRequestId: receivedRequest?._id?.toString(),
        isBlocked: Boolean(isBlocked),
        hasBlockedMe: Boolean(hasBlockedMe),
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

    if (!(await canViewProfileContent(req.user._id, req.params.userId))) {
      return res.json({ data: [], meta: { restricted: true } });
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
      meta: { restricted: false },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// USER PHOTOS (media attached to their posts)
// ============================================================

router.get("/users/:userId/photos", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Invalid user id." },
      });
    }

    if (!(await canViewProfileContent(req.user._id, req.params.userId))) {
      return res.json({ data: [], meta: { restricted: true } });
    }

    const posts = await Post.find({
      authorId: req.params.userId,
      deletedAt: null,
      "media.secureUrl": { $exists: true, $ne: null },
    })
      .select("media createdAt")
      .sort({ createdAt: -1 });

    res.json({
      data: posts.map((post) => ({
        postId: post._id.toString(),
        url: post.media.secureUrl,
        type: post.media.type,
        createdAt: post.createdAt,
      })),
      meta: { restricted: false },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// FEED
// ============================================================

module.exports = router;
