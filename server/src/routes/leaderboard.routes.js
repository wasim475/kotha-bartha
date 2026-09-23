const express = require("express");
const mongoose = require("mongoose");
const QuizAttempt = require("../models/QuizAttempt");
const User = require("../models/User");

const router = express.Router();

const TOP_COUNT = 20;

// Only a completed FIRST attempt counts toward the leaderboard — the same
// rule quiz.routes.js already enforces for an individual set's score (see
// isFirstAttempt there). Kept as one shared filter so the ranking and the
// per-user stats panel can never disagree with each other.
const LEADERBOARD_ATTEMPT_FILTER = { isFirstAttempt: true, status: "completed" };

function formatUser(user) {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    avatar: user.avatar || null,
    currentCity: user.currentCity || "",
  };
}

// Groups every qualifying attempt by user, joins in the user's profile
// fields, and — critically — drops admin/moderator accounts at the
// database query stage (not just hidden afterward in the response), so
// they can never occupy a rank or count toward totalParticipants.
// Currently only the Quiz category has real attempt data; `categories` is
// still returned as an array so a future category (e.g. Games) is a
// matter of adding another $facet-style source, not reshaping this
// endpoint's contract.
async function rankedParticipants() {
  const rows = await QuizAttempt.aggregate([
    { $match: LEADERBOARD_ATTEMPT_FILTER },
    {
      $group: {
        _id: "$userId",
        quizPoints: { $sum: "$score" },
        correctCount: { $sum: "$correctCount" },
        wrongCount: { $sum: "$wrongCount" },
        attempted: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    { $match: { "user.role": "user" } },
    {
      $project: {
        userId: "$_id",
        fullName: "$user.fullName",
        avatar: "$user.avatar",
        currentCity: "$user.currentCity",
        quizPoints: 1,
        correctCount: 1,
        wrongCount: 1,
        attempted: 1,
        totalPoints: "$quizPoints",
      },
    },
    // Deterministic ranking: total points, then more correct answers as a
    // tie-break, then a stable id order so ties never reorder between
    // requests.
    { $sort: { totalPoints: -1, correctCount: -1, userId: 1 } },
  ]);

  return rows.map((row, index) => ({
    rank: index + 1,
    id: row.userId.toString(),
    fullName: row.fullName,
    avatar: row.avatar || null,
    currentCity: row.currentCity || "",
    points: row.totalPoints,
  }));
}

router.get("/leaderboard/top", async (req, res, next) => {
  try {
    const participants = await rankedParticipants();
    const top = participants.slice(0, TOP_COUNT);

    const selfIndex = participants.findIndex((row) => row.id === req.user._id.toString());
    const me =
      selfIndex === -1
        ? null
        : { ...participants[selfIndex], inTop20: selfIndex < TOP_COUNT };

    res.json({
      data: {
        top,
        totalParticipants: participants.length,
        me,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/leaderboard/users/:userId/stats", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({
        error: { code: "INVALID_USER", message: "Invalid user." },
      });
    }

    const user = await User.findById(req.params.userId).select("fullName avatar currentCity role");
    if (!user || user.role !== "user") {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "This user isn't on the leaderboard." },
      });
    }

    const attempts = await QuizAttempt.find({
      userId: user._id,
      ...LEADERBOARD_ATTEMPT_FILTER,
    })
      .select("score correctCount wrongCount")
      .lean();

    const attempted = attempts.length;
    const correct = attempts.reduce((sum, attempt) => sum + attempt.correctCount, 0);
    const wrong = attempts.reduce((sum, attempt) => sum + attempt.wrongCount, 0);
    const quizPoints = attempts.reduce((sum, attempt) => sum + attempt.score, 0);
    const totalAnswered = correct + wrong;
    // wrongPercent derived as the remainder (not rounded independently) so
    // the two always sum to exactly 100, never 99 or 101.
    const correctPercent = totalAnswered > 0 ? Math.round((correct / totalAnswered) * 100) : 0;
    const wrongPercent = totalAnswered > 0 ? 100 - correctPercent : 0;

    res.json({
      data: {
        ...formatUser(user),
        totalPoints: quizPoints,
        categories: [{ key: "quiz", label: "Quiz", points: quizPoints }],
        quiz: {
          attempted,
          correct,
          wrong,
          correctPercent,
          wrongPercent,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
