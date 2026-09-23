// Shared ranking rules for the live Leaderboard (routes/leaderboard.routes.js)
// AND the monthly archive job (services/leaderboardArchive.service.js) —
// kept in one place so the archive is guaranteed to use the exact same
// ranking logic as the live view, never a parallel reimplementation.
const mongoose = require("mongoose");
const QuizAttempt = require("../models/QuizAttempt");
const Friendship = require("../models/Friendship");
const { blockedPairIds } = require("../utils/blocks");
const { getCycleStatus, cycleStartInstant, previousMonthOf } = require("./leaderboardCycle.service");

const TOP_COUNT = 20;
const CATEGORIES = ["overall", "quiz", "games"];
const PERIODS = ["all", "month", "week"];
const AUDIENCES = ["everyone", "friends"];

// Only a completed FIRST attempt counts toward the leaderboard — the same
// rule quiz.routes.js already enforces for an individual set's score (see
// isFirstAttempt there). Kept as one shared base filter so every view
// (ranking, rank-change, per-user stats, the monthly archive) can never
// disagree with each other.
const BASE_ATTEMPT_FILTER = { isFirstAttempt: true, status: "completed" };

function startOfWeek(referenceDate) {
  const day = referenceDate.getDay(); // 0 = Sunday
  const diffToMonday = (day + 6) % 7;
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);
  return start;
}

// "This Month" now follows the Leaderboard's own monthly cycle (8:00 AM on
// the 1st through 4:00 PM finalization on the last day, in
// LEADERBOARD_TIMEZONE — see leaderboardCycle.service.js) rather than the
// plain calendar month, so points earned in the closed window between one
// month's finalization and the next month's opening are never counted
// toward either month's "This Month" total (they still count toward "All
// Time" — see quiz.routes.js's scoring, which is untouched). Returns null
// when there's currently no active monthly cycle to report at all (the
// closed window) — the caller is expected to treat that as "no data" /
// "leaderboard closed" rather than running a query with a 0-width range.
function periodDateMatch(period, referenceDate = new Date()) {
  if (period === "week") {
    return { completedAt: { $gte: startOfWeek(referenceDate), $lte: referenceDate } };
  }
  if (period === "month") {
    const cycle = getCycleStatus(referenceDate);
    if (cycle.status !== "active") return null;
    return { completedAt: { $gte: cycleStartInstant(cycle.year, cycle.month), $lte: referenceDate } };
  }
  return {};
}

// The immediately-preceding window for the same period, used only for
// rank-change — never for the points/ranking actually shown. Returns null
// for "all" (there's no reliable "previous all-time" to compare against)
// and whenever there's no well-defined previous cycle to compare a closed
// "month" view against — see rankChangeFor below, which never invents
// movement when this is null.
function previousPeriodDateMatch(period, referenceDate = new Date()) {
  if (period === "week") {
    const currentStart = startOfWeek(referenceDate);
    const start = new Date(currentStart);
    start.setDate(start.getDate() - 7);
    return { completedAt: { $gte: start, $lt: currentStart } };
  }
  if (period === "month") {
    const cycle = getCycleStatus(referenceDate);
    if (cycle.status !== "active") return null;
    const prev = previousMonthOf(cycle.year, cycle.month);
    return {
      completedAt: {
        $gte: cycleStartInstant(prev.year, prev.month),
        $lt: cycleStartInstant(cycle.year, cycle.month),
      },
    };
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
//
// `requesterId` is optional — pass null/undefined for a viewer-independent
// snapshot (friends scoping and block-filtering are both inherently
// relative to a specific viewer, so the monthly archive job calls this
// without one to get one objective, global ranking).
async function rankedParticipants({ category, dateMatch, audience, requesterId }) {
  if (category === "games" || dateMatch === null) return [];

  const match = { ...BASE_ATTEMPT_FILTER, ...dateMatch };

  if (audience === "friends" && requesterId) {
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
        wrongCount: 1,
        attempted: 1,
      },
    },
    // Deterministic ranking: total points, then more correct answers as a
    // tie-break, then a stable id order so ties never reorder between
    // requests.
    { $sort: { totalPoints: -1, correctCount: -1, userId: 1 } },
  ]);

  const blocked = requesterId ? await blockedPairIds(requesterId) : new Set();
  const eligible = rows.filter((row) => !blocked.has(row.userId.toString()));

  return eligible.map((row, index) => ({
    rank: index + 1,
    id: row.userId.toString(),
    fullName: row.fullName,
    avatar: row.avatar || null,
    currentCity: row.currentCity || "",
    points: row.totalPoints,
    quizPoints: row.totalPoints,
    correctCount: row.correctCount,
    wrongCount: row.wrongCount,
    attempted: row.attempted,
  }));
}

function rankChangeFor(userId, currentRank, previousRankById) {
  if (!previousRankById) return null; // no reliable "previous" to compare
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

module.exports = {
  TOP_COUNT,
  CATEGORIES,
  PERIODS,
  AUDIENCES,
  BASE_ATTEMPT_FILTER,
  periodDateMatch,
  previousPeriodDateMatch,
  rankedParticipants,
  rankChangeFor,
  nextRankInfo,
};
