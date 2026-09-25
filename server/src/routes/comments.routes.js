const express = require("express");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Reaction = require("../models/Reaction");
const { serializeComment } = require("../utils/serializers");
const { createNotification } = require("../services/notification.service");
const { REACTION_TYPES } = require("../utils/reactionTypes");
const { ACTIONS, requireAction, VISIBLE_CONTENT } = require("../utils/moderation");
const { deleteCommentThread } = require("../services/contentModeration.service");

const router = express.Router();

// Walks parentId links up to the thread root. Used so every notification
// about a comment or reply can carry a consistent commentId (always the
// top-level thread) alongside a replyId (set only for an actual reply) —
// the structured pair the client needs to deep-link and expand the right
// thread without guessing from text.
async function resolveTopLevelId(startId) {
  let id = startId;
  let current = await Comment.findById(id).select("parentId").lean();
  while (current?.parentId) {
    id = current.parentId;
    current = await Comment.findById(id).select("parentId").lean();
  }
  return id;
}

router.get("/posts/:postId/comments", async (req, res, next) => {
  try {
    const comments = await Comment.find({
      postId: req.params.postId,
      ...VISIBLE_CONTENT,
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

// A reply is a comment with a parentId, so the moderation action depends on the body.
router.post(
  "/posts/:postId/comments",
  requireAction((req) => (req.body?.parentId ? ACTIONS.REPLY : ACTIONS.COMMENT)),
  async (req, res, next) => {
  try {
    const body = String(req.body.body || "").trim();
    const parentId = req.body.parentId || null;

    const post = await Post.findOne({
      _id: req.params.postId,
      deletedAt: null,
      ...VISIBLE_CONTENT,
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
        ...VISIBLE_CONTENT,
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

    const isReply = Boolean(parentId);
    const threadRootId = isReply ? await resolveTopLevelId(parentId) : comment._id;
    const notificationTarget = {
      postId: post._id,
      commentId: threadRootId,
      replyId: isReply ? comment._id : null,
    };

    if (post.authorId.toString() !== req.user._id.toString()) {
      await createNotification(req, {
        recipientId: post.authorId,
        actorId: req.user._id,
        type: "post_comment",
        entityType: "post",
        entityId: post._id,
        ...notificationTarget,
        payload: {
          message: isReply
            ? `${req.user.fullName} replied to a comment on your post.`
            : `${req.user.fullName} commented on your post.`,
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
        ...notificationTarget,
        payload: {
          message: isReply
            ? `${req.user.fullName} also replied in a thread you're part of.`
            : `${req.user.fullName} also commented on a post you joined.`,
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

router.patch("/comments/:commentId", requireAction(ACTIONS.EDIT_POST), async (req, res, next) => {
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
    const existing = await Comment.findOne({
      _id: req.params.commentId,
      authorId: req.user._id,
    }).select("parentId");

    if (!existing) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Comment not found." },
      });
    }

    // Comment, its replies, reactions and notifications: the shared cascade
    // (also used by the Admin Panel) — see services/contentModeration.service.js.
    const allIds = await deleteCommentThread(existing);

    res.json({
      data: {
        id: existing._id.toString(),
        deleted: true,
        deletedIds: allIds.map((id) => id.toString()),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.put("/comments/:commentId/reaction", requireAction(ACTIONS.REACT), async (req, res, next) => {
  try {
    const type = req.body.type;
    const comment = await Comment.findOne({ _id: req.params.commentId, ...VISIBLE_CONTENT });

    if (!comment || (type && !REACTION_TYPES.includes(type))) {
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
        const isReply = Boolean(comment.parentId);
        const threadRootId = isReply
          ? await resolveTopLevelId(comment.parentId)
          : comment._id;

        await createNotification(req, {
          recipientId: comment.authorId,
          actorId: req.user._id,
          type: "comment_reaction",
          entityType: "post",
          entityId: comment.postId,
          postId: comment.postId,
          commentId: threadRootId,
          replyId: isReply ? comment._id : null,
          payload: {
            message: isReply
              ? `${req.user.fullName} reacted to your reply.`
              : `${req.user.fullName} reacted to your comment.`,
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
