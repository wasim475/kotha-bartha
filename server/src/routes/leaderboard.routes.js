const express = require("express");
const mongoose = require("mongoose");
const QuizAttempt = require("../models/QuizAttempt");
const User = require("../models/User");
const Friendship = require("../models/Friendship");
const { isBlockedEitherWay, blockedPairIds } = require("../utils/blocks");

const router = express.Router();

const TOP_COUNT = 20;
const CATEGORIES = ["overall", "quiz", "games"];
const PERIODS = ["all", "month", "week"];
const AUDIENCES = ["everyone", "friends"];

// Only a completed FIRST attempt counts toward the leaderboard — the same
// rule quiz.routes.js already enforces for an individual set's score (see
// isFirstAttempt there). Kept as one shared base filter so every view
// (ranking, rank-change, per-user stats) can never disagree with each other.
const BASE_ATTEMPT_FILTER = { isFirstAttempt: true, status: "completed" };

// ============================================================
// Date windows — period-based points are derived from each attempt's own
// `completedAt`, which already exists on every attempt; no new schema or
// stored snapshot is needed to answer "points earned this week/month."
// ============================================================

function startOfWeek(referenceDate) {
  const day = referenceDate.getDay(); // 0 = Sunday
  const diffToMonday = (day + 6) % 7;
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);
  return start;
}

function periodDateMatch(period, referenceDate = new Date()) {
  if (period === "week") {
    return { completedAt: { $gte: startOfWeek(referenceDate), $lte: referenceDate } };
  }
  if (period === "month") {
    const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    return { completedAt: { $gte: start, $lte: referenceDate } };
  }
  return {};
}

// The immediately-preceding window for the same period, used only for
// rank-change — never for the points/ranking actually shown. Returns null
// for "all" (there's no reliable "previous all-time" to compare against,
// so rank-change is simply not offered for that period — see
// rankChangeFor below).
function previousPeriodDateMatch(period, referenceDate = new Date()) {
  if (period === "week") {
    const currentStart = startOfWeek(referenceDate);
    const start = new Date(currentStart);
    start.setDate(start.getDate() - 7);
    return { completedAt: { $gte: start, $lt: currentStart } };
  }
  if (period === "month") {
    const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);
    const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    return { completedAt: { $gte: start, $lt: end } };
  }
  return null;
}

async function friendIdsOf(userId) {
  const friendships = await Friendship.find({ userIds: userId }).select("userIds").lean();
  return friendships.flatMap((friendship) => friendship.userIds.map(String)).filter((id) => id !== userId.toString());
}

// Groups every qualifying attempt (within the given date window) by user,
// joins in the user's profile fields, and — critically — drops
// admin/moderator accounts and blocked pairs at the query stage, not just
// hidden afterward in the response, so they can never occupy a rank or
// count toward a participant total. Ranks are assigned only after every
// exclusion, so the sequence is always contiguous (1, 2, 3, …) with no
// gaps left by a removed user.
//
// `category: "games"` returns an empty list rather than a real query —
// there's no Games attempt data source in this app yet, so "reporting
// zero participation" is the honest answer, not an invented one.
// `category: "overall"` currently equals `"quiz"` for the same reason
// (overall = quiz + games, and games always contributes 0 today); a real
// Games source would only need to be unioned in here later.
async function rankedParticipants({ category, dateMatch, audience, requesterId }) {
  if (category === "games") return [];

  const match = { ...BASE_ATTEMPT_FILTER, ...dateMatch };

  if (audience === "friends") {
    const friendIds = await friendIdsOf(requesterId);
    const scopeIds = [...friendIds, requesterId.toString()].map((id) => new mongoose.Types.ObjectId(id));
    match.userId = { $in: scopeIds };
  }

  const rows = await QuizAttempt.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$userId",
        quizPoints: { $sum: "$score" },
        correctCount: { $sum: "$correctCount" },
        wrongCount: { $sum: "$wrongCount" },
        attempted: { $sum: 1 },
      },
    },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
    { $match: { "user.role": "user" } },
    {
      $project: {
        userId: "$_id",
        fullName: "$user.fullName",
        avatar: "$user.avatar",
        currentCity: "$user.currentCity",
        totalPoints: "$quizPoints",
        correctCount: 1,
      },
    },
    // Deterministic ranking: total points, then more correct answers as a
    // tie-break, then a stable id order so ties never reorder between
    // requests.
    { $sort: { totalPoints: -1, correctCount: -1, userId: 1 } },
  ]);

  const blocked = await blockedPairIds(requesterId);
  const eligible = rows.filter((row) => !blocked.has(row.userId.toString()));

  return eligible.map((row, index) => ({
    rank: index + 1,
    id: row.userId.toString(),
    fullName: row.fullName,
    avatar: row.avatar || null,
    currentCity: row.currentCity || "",
    points: row.totalPoints,
  }));
}

function rankChangeFor(userId, currentRank, previousRankById) {
  if (!previousRankById) return null; // period "all" — no reliable "previous" to compare
  const previousRank = previousRankById.get(userId);
  if (previousRank === undefined) return null; // wasn't ranked last period — don't invent movement
  const delta = previousRank - currentRank; // positive = moved up (a smaller rank number is better)
  return { direction: delta > 0 ? "up" : delta < 0 ? "down" : "same", delta: Math.abs(delta) };
}

// The row immediately above the current user in the SAME already-ranked
// list, so "next rank" always reflects the exact same filtered dataset as
// everything else on the page (never a different category/period/audience).
function nextRankInfo(participants, myRank) {
  if (myRank === 1) return { isFirst: true };
  const aboveRow = participants[myRank - 2];
  const myRow = participants[myRank - 1];
  if (!aboveRow || !myRow) return null;
  return {
    rank: aboveRow.rank,
    points: aboveRow.points,
    // A tie with the row above means 0 more points are actually needed —
    // reporting anything else would be misleading.
    pointsNeeded: Math.max(0, aboveRow.points - myRow.points),
  };
}

router.get("/leaderboard/top", async (req, res, next) => {
  try {
    const category = CATEGORIES.includes(req.query.category) ? req.query.category : "overall";
    const period = PERIODS.includes(req.query.period) ? req.query.period : "all";
    const audience = AUDIENCES.includes(req.query.audience) ? req.query.audience : "everyone";

    const participants = await rankedParticipants({
      category,
      dateMatch: periodDateMatch(period),
      audience,
      requesterId: req.user._id,
    });

    let previousRankById = null;
    const previousDateMatch = previousPeriodDateMatch(period);
    if (previousDateMatch) {
      const previousParticipants = await rankedParticipants({
        category,
        dateMatch: previousDateMatch,
        audience,
        requesterId: req.user._id,
      });
      previousRankById = new Map(previousParticipants.map((row) => [row.id, row.rank]));
    }

    const withRankChange = (row) => ({ ...row, rankChange: rankChangeFor(row.id, row.rank, previousRankById) });

    const top20 = participants.slice(0, TOP_COUNT).map(withRankChange);
    const top3 = top20.slice(0, 3);

    const selfIndex = participants.findIndex((row) => row.id === req.user._id.toString());
    const me =
      selfIndex === -1
        ? null
        : {
            ...withRankChange(participants[selfIndex]),
            inTop20: selfIndex < TOP_COUNT,
            nextRank: nextRankInfo(participants, participants[selfIndex].rank),
          };

    res.json({
      data: {
        category,
        period,
        audience,
        top3,
        top20,
        totalParticipants: participants.length,
        participantLabel: audience === "friends" ? "Friends Participating" : "Total Participants",
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
    if (await isBlockedEitherWay(req.user._id, user._id)) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "This user isn't on the leaderboard." },
      });
    }

    const period = PERIODS.includes(req.query.period) ? req.query.period : "all";

    const attempts = await QuizAttempt.find({
      userId: user._id,
      ...BASE_ATTEMPT_FILTER,
      ...periodDateMatch(period),
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
        id: user._id.toString(),
        fullName: user.fullName,
        avatar: user.avatar || null,
        currentCity: user.currentCity || "",
        period,
        totalPoints: quizPoints,
        categories: [{ key: "quiz", label: "Quiz", points: quizPoints }],
        quiz: { attempted, correct, wrong, correctPercent, wrongPercent },
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
