const express = require("express");
const Story = require("../models/Story");
const Friendship = require("../models/Friendship");
const { safeUser, serializeStory } = require("../utils/serializers");
const { emitToUser } = require("../utils/realtime");
const { upload } = require("../middleware/upload");
const { uploadBuffer, destroyAsset } = require("../utils/cloudinary");

const router = express.Router();

const MAX_TEXT_LENGTH = 500;
const MAX_COLOR_LENGTH = 20;

// Same friendIds-from-Friendship derivation posts.routes.js's own
// GET /posts/feed already uses — a story is visible to exactly the same
// audience a post is (friends, plus the author themself), so this reuses
// that existing rule rather than introducing a separate privacy system.
async function friendIdsFor(userId) {
  const friendships = await Friendship.find({ userIds: userId }).select("userIds").lean();
  return friendships
    .flatMap((friendship) => friendship.userIds.map(String))
    .filter((id) => id !== userId.toString());
}

// ============================================================
// LIST ACTIVE STORIES — grouped by author (self first, then friends by
// most recent story), never-expired only. Expired stories are removed by
// MongoDB's TTL index on Story.expiresAt (see the model) — this filter is
// a defensive belt-and-suspenders since TTL cleanup isn't instantaneous.
// ============================================================

router.get("/stories", async (req, res, next) => {
  try {
    const now = new Date();
    const friendIds = await friendIdsFor(req.user._id);
    const authorIds = [req.user._id, ...friendIds];

    const stories = await Story.find({
      authorId: { $in: authorIds },
      expiresAt: { $gt: now },
    })
      .populate("authorId")
      .sort({ createdAt: 1 })
      .lean();

    const groupsById = new Map();
    for (const story of stories) {
      const authorId = story.authorId._id.toString();
      if (!groupsById.has(authorId)) {
        groupsById.set(authorId, {
          author: safeUser(story.authorId),
          isMine: authorId === req.user._id.toString(),
          stories: [],
        });
      }
      groupsById.get(authorId).stories.push(serializeStory(story));
    }

    const groups = [...groupsById.values()].sort((a, b) => {
      if (a.isMine !== b.isMine) return a.isMine ? -1 : 1;
      const aLatest = a.stories[a.stories.length - 1].createdAt;
      const bLatest = b.stories[b.stories.length - 1].createdAt;
      return new Date(bLatest) - new Date(aLatest);
    });

    res.json({ data: groups });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// CREATE STORY — text (colored background + colored text) or image
// (uploaded via the same Cloudinary pipeline as posts/messages, with an
// optional short text overlay).
// ============================================================

router.post(
  "/stories",
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
          error: { code: "UNSUPPORTED_FILE_TYPE", message: "Choose an image for your story." },
        });
      }
      next(error);
    });
  },
  async (req, res, next) => {
    try {
      const type = req.body.type === "image" ? "image" : "text";
      const text = String(req.body.text || "").trim().slice(0, MAX_TEXT_LENGTH);
      const textColor = String(req.body.textColor || "#ffffff").trim().slice(0, MAX_COLOR_LENGTH);

      if (type === "image") {
        if (!req.file) {
          return res.status(400).json({
            error: { code: "VALIDATION_ERROR", message: "Choose an image for your story." },
          });
        }
        if (!req.file.mimetype.startsWith("image/")) {
          return res.status(400).json({
            error: { code: "INVALID_FILE", message: "Choose an image for your story." },
          });
        }

        const result = await uploadBuffer(req.file.buffer, {
          kind: "image",
          folder: "kotha-bartha/stories",
        });

        const story = await Story.create({
          authorId: req.user._id,
          type: "image",
          text,
          textColor,
          media: { publicId: result.public_id, secureUrl: result.secure_url },
        });
        await story.populate("authorId");

        const friendIds = await friendIdsFor(req.user._id);
        friendIds.forEach((friendId) =>
          emitToUser(req, friendId, "story:new", { authorId: req.user._id.toString() }),
        );

        return res.status(201).json({ data: serializeStory(story) });
      }

      if (!text) {
        return res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Story text is required." },
        });
      }

      const backgroundColor = String(req.body.backgroundColor || "#e96449")
        .trim()
        .slice(0, MAX_COLOR_LENGTH);

      const story = await Story.create({
        authorId: req.user._id,
        type: "text",
        text,
        textColor,
        backgroundColor,
      });
      await story.populate("authorId");

      const friendIds = await friendIdsFor(req.user._id);
      friendIds.forEach((friendId) =>
        emitToUser(req, friendId, "story:new", { authorId: req.user._id.toString() }),
      );

      res.status(201).json({ data: serializeStory(story) });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================================
// DELETE STORY — sender-only, works whether or not it's already expired
// (an expired one would already be gone via the TTL index anyway).
// ============================================================

router.delete("/stories/:storyId", async (req, res, next) => {
  try {
    const story = await Story.findOneAndDelete({
      _id: req.params.storyId,
      authorId: req.user._id,
    });

    if (!story) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Story not found." },
      });
    }

    if (story.media?.publicId) destroyAsset(story.media.publicId, "image");

    const friendIds = await friendIdsFor(req.user._id);
    friendIds.forEach((friendId) =>
      emitToUser(req, friendId, "story:deleted", {
        id: story._id.toString(),
        authorId: req.user._id.toString(),
      }),
    );

    res.json({ data: { id: story._id.toString(), deleted: true } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
