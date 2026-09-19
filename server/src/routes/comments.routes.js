const express = require("express");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Reaction = require("../models/Reaction");
const { serializeComment } = require("../utils/serializers");
const { createNotification } = require("../services/notification.service");

const router = express.Router();

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
    const parentId = req.body.parentId || null;

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

    if (parentId) {
      const parent = await Comment.findOne({
        _id: parentId,
        postId: post._id,
      });

      if (!parent) {
        return res.status(400).json({
          error: {
            code: "INVALID_PARENT",
            message: "Comment reply target not found.",
          },
        });
      }
    }

    const comment = await Comment.create({
      postId: post._id,
      authorId: req.user._id,
      parentId,
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

router.patch("/comments/:commentId", async (req, res, next) => {
  try {
    const body = String(req.body.body || "").trim();
    const comment = await Comment.findOne({
      _id: req.params.commentId,
      authorId: req.user._id,
    }).populate("authorId");

    if (!comment || !body) {
      return res.status(400).json({
        error: {
          code: "INVALID_COMMENT",
          message: "Comment text is required.",
        },
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
        error: {
          code: "INVALID_REACTION",
          message: "Invalid comment reaction.",
        },
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

      if (comment.authorId.toString() !== req.user._id.toString()) {
        await createNotification(req, {
          recipientId: comment.authorId,
          actorId: req.user._id,
          type: "comment_reaction",
          entityType: "post",
          entityId: comment.postId,
          payload: {
            message: `${req.user.fullName} reacted to your comment.`,
          },
          uniqueEventId: `comment-reaction:${comment._id}:${req.user._id}`,
        });
      }
    }

    const reactions = await Reaction.find({
      targetType: "comment",
      targetId: comment._id,
    })
      .select("type")
      .lean();

    res.json({
      data: {
        reaction: type || null,
        reactions: reactions.reduce(
          (counts, entry) => ({
            ...counts,
            [entry.type]: (counts[entry.type] || 0) + 1,
          }),
          {},
        ),
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
