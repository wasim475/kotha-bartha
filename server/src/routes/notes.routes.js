const express = require("express");
const Note = require("../models/Note");
const Friendship = require("../models/Friendship");
const { safeUser, serializeNote } = require("../utils/serializers");
const { emitToUser } = require("../utils/realtime");
const { isBlockedEitherWay } = require("../utils/blocks");
const { sendContextMessage } = require("../utils/contextMessages");

const router = express.Router();

const MAX_NOTE_LENGTH = 150;

// Same friendIds-from-Friendship derivation stories.routes.js/
// posts.routes.js already use — a note is visible to exactly the same
// audience a story is (friends, plus the author themself).
async function friendIdsFor(userId) {
  const friendships = await Friendship.find({ userIds: userId }).select("userIds").lean();
  return friendships
    .flatMap((friendship) => friendship.userIds.map(String))
    .filter((id) => id !== userId.toString());
}

// ============================================================
// LIST ACTIVE NOTES — one per author (self first, then friends by most
// recent), never-expired only. Expired notes are removed by MongoDB's TTL
// index on Note.expiresAt; this filter is defensive belt-and-suspenders
// since TTL cleanup isn't instantaneous — same pattern as stories.routes.js.
// ============================================================

router.get("/notes", async (req, res, next) => {
  try {
    const now = new Date();
    const friendIds = await friendIdsFor(req.user._id);
    const authorIds = [req.user._id, ...friendIds];

    const notes = await Note.find({
      authorId: { $in: authorIds },
      expiresAt: { $gt: now },
    })
      .populate("authorId")
      .lean();

    const entries = notes.map((note) => ({
      author: safeUser(note.authorId),
      isMine: note.authorId._id.toString() === req.user._id.toString(),
      note: serializeNote(note),
    }));

    entries.sort((a, b) => {
      if (a.isMine !== b.isMine) return a.isMine ? -1 : 1;
      return new Date(b.note.createdAt) - new Date(a.note.createdAt);
    });

    res.json({ data: entries });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// CREATE NOTE — one active note per user; posting a new one refreshes
// (overwrites) the previous one rather than stacking up a history.
// ============================================================

router.post("/notes", async (req, res, next) => {
  try {
    const text = String(req.body.text || "").trim().slice(0, MAX_NOTE_LENGTH);
    if (!text) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Write something for your note." },
      });
    }

    const note = await Note.findOneAndUpdate(
      { authorId: req.user._id },
      { $set: { text, expiresAt: new Date(Date.now() + Note.NOTE_EXPIRY_MS) } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    await note.populate("authorId");

    const friendIds = await friendIdsFor(req.user._id);
    friendIds.forEach((friendId) =>
      emitToUser(req, friendId, "note:new", { authorId: req.user._id.toString() }),
    );

    res.status(201).json({ data: serializeNote(note) });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// DELETE NOTE — sender-only.
// ============================================================

router.delete("/notes/:noteId", async (req, res, next) => {
  try {
    const note = await Note.findOneAndDelete({
      _id: req.params.noteId,
      authorId: req.user._id,
    });

    if (!note) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Note not found." },
      });
    }

    const friendIds = await friendIdsFor(req.user._id);
    friendIds.forEach((friendId) =>
      emitToUser(req, friendId, "note:deleted", {
        id: note._id.toString(),
        authorId: req.user._id.toString(),
      }),
    );

    res.json({ data: { id: note._id.toString(), deleted: true } });
  } catch (error) {
    next(error);
  }
});

// Shared guard for the react/reply routes below — mirrors
// stories.routes.js's loadReactableStory exactly (same rules: must still
// be active, not your own, friends-only, not blocked).
async function loadReactableNote(req, res) {
  const note = await Note.findOne({
    _id: req.params.noteId,
    expiresAt: { $gt: new Date() },
  }).populate("authorId");

  if (!note) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "This note is no longer available." },
    });
    return null;
  }
  if (note.authorId._id.toString() === req.user._id.toString()) {
    res.status(400).json({
      error: { code: "INVALID_TARGET", message: "You can't react to your own note." },
    });
    return null;
  }
  const isFriend = await Friendship.exists({
    userIds: { $all: [req.user._id, note.authorId._id] },
  });
  if (!isFriend) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "This note is no longer available." },
    });
    return null;
  }
  if (await isBlockedEitherWay(req.user._id, note.authorId._id)) {
    res.status(403).json({
      error: { code: "BLOCKED", message: "You can't message this user." },
    });
    return null;
  }
  return note;
}

const noteSnapshot = (note) => ({
  kind: "note",
  text: note.text,
  textColor: null,
  backgroundColor: null,
  mediaUrl: null,
});

// ============================================================
// NOTE REACTION / REPLY — same shape as stories.routes.js's react/reply:
// sends a normal 1:1 message to the note's owner carrying a `storyContext`
// snapshot, never a new "note" of its own.
// ============================================================

router.post("/notes/:noteId/react", async (req, res, next) => {
  try {
    const emoji = String(req.body.emoji || "").trim().slice(0, 8);
    if (!emoji) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Choose a reaction." },
      });
    }

    const note = await loadReactableNote(req, res);
    if (!note) return;

    const { payload, deduped } = await sendContextMessage(req, {
      owner: note.authorId,
      body: `Reacted ${emoji} to your Note`,
      storyContext: {
        refType: "note",
        refId: note._id,
        action: "reaction",
        reactionEmoji: emoji,
        authorId: note.authorId._id,
        expiresAt: note.expiresAt,
        snapshot: noteSnapshot(note),
      },
    });

    res.status(201).json({ data: { sent: true, deduped, message: payload } });
  } catch (error) {
    next(error);
  }
});

router.post("/notes/:noteId/reply", async (req, res, next) => {
  try {
    const text = String(req.body.text || "").trim().slice(0, 2000);
    if (!text) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Write a reply." },
      });
    }

    const note = await loadReactableNote(req, res);
    if (!note) return;

    const { payload } = await sendContextMessage(req, {
      owner: note.authorId,
      body: text,
      storyContext: {
        refType: "note",
        refId: note._id,
        action: "reply",
        reactionEmoji: null,
        authorId: note.authorId._id,
        expiresAt: note.expiresAt,
        snapshot: noteSnapshot(note),
      },
    });

    res.status(201).json({ data: { sent: true, message: payload } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
