const express = require("express");
const mongoose = require("mongoose");
const QuizAttempt = require("../models/QuizAttempt");
const GameAttempt = require("../models/GameAttempt");
const TicTacToeGame = require("../models/TicTacToeGame");
const LudoGame = require("../models/LudoGame");
const GameChallengeMatch = require("../models/GameChallengeMatch");
const User = require("../models/User");
const LeaderboardArchive = require("../models/LeaderboardArchive");
const { isBlockedEitherWay } = require("../utils/blocks");
const { LEADERBOARD_TIMEZONE } = require("../utils/timezone");
const { getCycleStatus } = require("../services/leaderboardCycle.service");
const {
  TOP_COUNT,
  CATEGORIES,
  PERIODS,
  BASE_ATTEMPT_FILTER,
  GAME_ATTEMPT_FILTER,
  periodDateMatch,
  previousPeriodDateMatch,
  rankedParticipants,
  rankChangeFor,
  nextRankInfo,
} = require("../services/leaderboardRanking.service");

// The Everyone/Friends audience filter was removed from the Leaderboard —
// every ranking request is now always the single, global "everyone" view.
const AUDIENCE = "everyone";

const router = express.Router();

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function cyclePayload(cycle) {
  if (cycle.status === "active") {
    return {
      status: "active",
      label: `${MONTH_NAMES[cycle.month - 1]} ${cycle.year} Leaderboard`,
      closesAt: cycle.closesAt,
      timezone: LEADERBOARD_TIMEZONE,
    };
  }
  return {
    status: "closed",
    label: "Leaderboard Closed",
    closedMonthLabel: `${MONTH_NAMES[cycle.closedMonth - 1]} ${cycle.closedYear}`,
    opensAt: cycle.opensAt,
    closesAt: cycle.closesAt,
    timezone: LEADERBOARD_TIMEZONE,
  };
}

router.get("/leaderboard/top", async (req, res, next) => {
  try {
    const category = CATEGORIES.includes(req.query.category) ? req.query.category : "overall";
    const period = PERIODS.includes(req.query.period) ? req.query.period : "month";

    const cycle = period === "month" ? getCycleStatus() : null;

    // The monthly cycle is currently closed (between one month's 4:00 PM
    // finalization and the next month's 8:00 AM start) — there is no
    // active "this month" ranking to show, by design (see
    // leaderboardRanking.service.js's periodDateMatch). Report that
    // explicitly rather than running a query with a meaningless range.
    if (period === "month" && cycle.status === "closed") {
      return res.json({
        data: {
          category,
          period,
          top3: [],
          top20: [],
          totalParticipants: 0,
          participantLabel: "Total Participants",
          me: null,
          cycle: cyclePayload(cycle),
        },
      });
    }

    const participants = await rankedParticipants({
      category,
      dateMatch: periodDateMatch(period),
      audience: AUDIENCE,
      requesterId: req.user._id,
    });

    let previousRankById = null;
    const previousDateMatch = previousPeriodDateMatch(period);
    if (previousDateMatch) {
      const previousParticipants = await rankedParticipants({
        category,
        dateMatch: previousDateMatch,
        audience: AUDIENCE,
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
        top3,
        top20,
        totalParticipants: participants.length,
        participantLabel: "Total Participants",
        me,
        cycle: cycle ? cyclePayload(cycle) : null,
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
    if (!user || user.role !== "user" || user.accountStatus === "deleted") {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "This user isn't on the leaderboard." },
      });
    }
    if (await isBlockedEitherWay(req.user._id, user._id)) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "This user isn't on the leaderboard." },
      });
    }

    const period = PERIODS.includes(req.query.period) ? req.query.period : "month";
    const dateMatch = periodDateMatch(period);

    const attempts = dateMatch
      ? await QuizAttempt.find({ userId: user._id, ...BASE_ATTEMPT_FILTER, ...dateMatch })
          .select("score correctCount wrongCount")
          .lean()
      : [];

    const attempted = attempts.length;
    const correct = attempts.reduce((sum, attempt) => sum + attempt.correctCount, 0);
    const wrong = attempts.reduce((sum, attempt) => sum + attempt.wrongCount, 0);
    const quizPoints = attempts.reduce((sum, attempt) => sum + attempt.score, 0);
    // Completed game attempts count every time (see GAME_ATTEMPT_FILTER).
    const gameAttempts = dateMatch
      ? await GameAttempt.find({ userId: user._id, ...GAME_ATTEMPT_FILTER, ...dateMatch }).select("score").lean()
      : [];
    const tttWins = dateMatch
      ? await TicTacToeGame.find({
          status: "won",
          winnerId: user._id,
          ...(dateMatch.completedAt ? { finishedAt: dateMatch.completedAt } : {}),
        })
          .select("rewardPoints")
          .lean()
      : [];
    // Friend quiz challenges: only matches this user WON carry points.
    const challengeWins = dateMatch
      ? await GameChallengeMatch.find({
          status: "completed",
          winnerId: user._id,
          ...(dateMatch.completedAt ? { finishedAt: dateMatch.completedAt } : {}),
        })
          .select("rewardPoints")
          .lean()
      : [];
    // Ludo: the points this user earned in finished, legitimately rewarded matches.
    const ludoPoints = dateMatch
      ? (
          await LudoGame.aggregate([
            { $match: { status: "finished", rewardsGranted: true, participantIds: user._id, ...(dateMatch.completedAt ? { finishedAt: dateMatch.completedAt } : {}) } },
            { $unwind: "$rankings" },
            { $match: { "rankings.userId": user._id } },
            { $group: { _id: null, points: { $sum: "$rankings.rewardPoints" } } },
          ])
        )[0]?.points || 0
      : 0;
    const gamePoints =
      ludoPoints +
      gameAttempts.reduce((sum, attempt) => sum + attempt.score, 0) +
      tttWins.reduce((sum, game) => sum + (game.rewardPoints || 0), 0) +
      challengeWins.reduce((sum, match) => sum + (match.rewardPoints || 0), 0);

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
        totalPoints: quizPoints + gamePoints,
        categories: [
          { key: "quiz", label: "Quiz", points: quizPoints },
          { key: "games", label: "Games", points: gamePoints },
        ],
        quiz: { attempted, correct, wrong, correctPercent, wrongPercent },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// MONTHLY ARCHIVE (historical, read-only)
// ============================================================

// Lightweight — just the {year, month} pairs that actually have an
// archive, so the Previous Leaderboards page's selectors only ever offer
// months that exist instead of guessing a calendar range and hoping.
router.get("/leaderboard/archive/months", async (req, res, next) => {
  try {
    const months = await LeaderboardArchive.find({}).select("year month -_id").sort({ year: -1, month: -1 }).lean();
    res.json({ data: months });
  } catch (error) {
    next(error);
  }
});

router.get("/leaderboard/archive/:year/:month", async (req, res, next) => {
  try {
    const year = Number(req.params.year);
    const month = Number(req.params.month);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({
        error: { code: "INVALID_MONTH", message: "Choose a valid month and year." },
      });
    }

    const archive = await LeaderboardArchive.findOne({ year, month }).lean();
    if (!archive) {
      // Distinguish "this is the currently active/not-yet-finalized
      // month" from "this month genuinely has no archive" — the frontend
      // shows a different message for each (see requirement to not treat
      // the active month as a historical archive).
      const cycle = getCycleStatus();
      const isCurrentActiveMonth = cycle.status === "active" && cycle.year === year && cycle.month === month;
      return res.json({
        data: null,
        meta: { label: `${MONTH_NAMES[month - 1]} ${year}`, isCurrentActiveMonth },
      });
    }

    const withStats = (entry) => {
      const totalAnswered = entry.correctCount + entry.wrongCount;
      const correctPercent = totalAnswered > 0 ? Math.round((entry.correctCount / totalAnswered) * 100) : 0;
      const wrongPercent = totalAnswered > 0 ? 100 - correctPercent : 0;
      return {
        rank: entry.rank,
        id: entry.userId ? entry.userId.toString() : null,
        fullName: entry.fullName,
        avatar: entry.avatar || null,
        currentCity: entry.currentCity || "",
        points: entry.points,
        categories: [
          { key: "quiz", label: "Quiz", points: entry.quizPoints },
          { key: "games", label: "Games", points: entry.gamesPoints || 0 },
        ],
        quiz: {
          attempted: entry.attempted,
          correct: entry.correctCount,
          wrong: entry.wrongCount,
          correctPercent,
          wrongPercent,
        },
      };
    };

    const top20 = archive.entries.slice(0, TOP_COUNT).map(withStats);
    const top3 = top20.slice(0, 3);

    const selfEntry = archive.entries.find((entry) => entry.userId && entry.userId.toString() === req.user._id.toString());
    const me = selfEntry
      ? { ...withStats(selfEntry), inTop20: selfEntry.rank <= TOP_COUNT }
      : null;

    res.json({
      data: {
        year: archive.year,
        month: archive.month,
        label: `${MONTH_NAMES[archive.month - 1]} ${archive.year}`,
        periodStart: archive.periodStart,
        periodEnd: archive.periodEnd,
        totalParticipants: archive.totalParticipants,
        top3,
        top20,
        me,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
