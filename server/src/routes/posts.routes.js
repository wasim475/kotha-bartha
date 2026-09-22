const express = require("express");
const User = require("../models/User");
const Post = require("../models/Post");
const Friendship = require("../models/Friendship");
const Reaction = require("../models/Reaction");
const Notification = require("../models/Notification");
const { serializePost } = require("../utils/serializers");
const { emitToUser } = require("../utils/realtime");
const { createNotification } = require("../services/notification.service");
const { REACTION_TYPES } = require("../utils/reactionTypes");
const { upload } = require("../middleware/upload");
const { uploadBuffer, destroyAsset } = require("../utils/cloudinary");

const router = express.Router();

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

router.get("/posts/:postId", async (req, res, next) => {
  try {
    const post = await Post.findOne({
      _id: req.params.postId,
      deletedAt: null,
    }).populate("authorId");

    if (!post) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Post not found." },
      });
    }

    res.json({ data: await serializePost(post, req.user._id) });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// CREATE POST
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

router.post(
  "/posts",
  // A plain JSON (text-only) request never has a multipart Content-Type,
  // so multer passes it straight through unchanged — this only actually
  // parses requests that include an image file.
  (req, res, next) => {
    upload.single("file")(req, res, (error) => {
      if (!error) return next();
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          error: { code: "FILE_TOO_LARGE", message: "Image is larger than 15MB." },
        });
      }
      if (error.message === "UNSUPPORTED_FILE_TYPE") {
        return res.status(400).json({
          error: { code: "UNSUPPORTED_FILE_TYPE", message: "Choose an image for your post." },
        });
      }
      next(error);
    });
  },
  async (req, res, next) => {
    try {
      const body = String(req.body.body || "").trim();

      if (!body && !req.file) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Add some text or an image to post.",
          },
        });
      }
      if (req.file && !req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({
          error: { code: "INVALID_FILE", message: "Choose an image for your post." },
        });
      }

      let media;
      if (req.file) {
        const result = await uploadBuffer(req.file.buffer, {
          kind: "image",
          folder: "kotha-bartha/posts",
        });
        media = { publicId: result.public_id, secureUrl: result.secure_url, kind: "image" };
      }

      const post = await Post.create({
        authorId: req.user._id,
        body,
        media,
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
  },
);

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
        postId: post._id,
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
// REACT TO POST (unified 5-reaction system — like/love/haha/sad/angry)
// ============================================================

router.put("/posts/:postId/reaction", async (req, res, next) => {
  try {
    const type = req.body.type || null;

    if (type && !REACTION_TYPES.includes(type)) {
      return res.status(400).json({
        error: { code: "INVALID_REACTION", message: "Invalid reaction." },
      });
    }

    const post = await Post.findOne({
      _id: req.params.postId,
      deletedAt: null,
    });

    if (!post) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Post not found." },
      });
    }

    if (!type) {
      await Reaction.deleteOne({
        userId: req.user._id,
        targetType: "post",
        targetId: post._id,
      });
    } else {
      await Reaction.updateOne(
        { userId: req.user._id, targetType: "post", targetId: post._id },
        { $set: { type } },
        { upsert: true },
      );

      if (post.authorId.toString() !== req.user._id.toString()) {
        await createNotification(req, {
          recipientId: post.authorId,
          actorId: req.user._id,
          type: "post_reaction",
          entityType: "post",
          entityId: post._id,
          postId: post._id,
          payload: {
            message: `${req.user.fullName} reacted to your post.`,
          },
          uniqueEventId: `post-reaction:${post._id}:${req.user._id}`,
        });
      }
    }

    const reactionDocs = await Reaction.find({
      targetType: "post",
      targetId: post._id,
    })
      .select("userId type")
      .lean();

    const mine = reactionDocs.find(
      (entry) => entry.userId.toString() === req.user._id.toString(),
    );

    res.json({
      data: {
        reaction: mine?.type || null,
        reactions: reactionDocs.reduce(
          (counts, entry) => ({
            ...counts,
            [entry.type]: (counts[entry.type] || 0) + 1,
          }),
          {},
        ),
        likes: reactionDocs.length,
        liked: Boolean(mine),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET COMMENTS
// ============================================================

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

    if (post.media?.publicId) destroyAsset(post.media.publicId, "image");

    // Every notification about this post (post reactions, comments and
    // replies alike) points at content that no longer exists — clean them
    // all up in one shot rather than leaving dead links behind.
    await Notification.deleteMany({ postId: post._id });

    res.json({ data: { id: post._id.toString(), deleted: true } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
