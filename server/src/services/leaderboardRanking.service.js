// Shared ranking rules for the live Leaderboard (routes/leaderboard.routes.js)
// AND the monthly archive job (services/leaderboardArchive.service.js) —
// kept in one place so the archive is guaranteed to use the exact same
// ranking logic as the live view, never a parallel reimplementation.
const mongoose = require("mongoose");
const QuizAttempt = require("../models/QuizAttempt");
const GameAttempt = require("../models/GameAttempt");
const TicTacToeGame = require("../models/TicTacToeGame");
const GameChallengeMatch = require("../models/GameChallengeMatch");
const LudoGame = require("../models/LudoGame");
const Friendship = require("../models/Friendship");
const { blockedPairIds } = require("../utils/blocks");
const { getCycleStatus, cycleStartInstant, previousMonthOf } = require("./leaderboardCycle.service");

const TOP_COUNT = 20;
const CATEGORIES = ["overall", "quiz", "games"];
// "All Time" was removed from the Leaderboard entirely (UI and API) — the
// only selectable periods now are Today, This Week, and This Month.
const PERIODS = ["today", "week", "month"];
// The Everyone/Friends audience filter was removed from the Leaderboard —
// every ranking is now always the global "everyone" view. `rankedParticipants`
// below still accepts an `audience`/`requesterId` pair so the underlying
// friends-scoping capability isn't deleted outright, but routes/leaderboard.routes.js
// no longer reads an audience from the client and always passes "everyone".

// Only a completed FIRST attempt counts toward the leaderboard — the same
// rule quiz.routes.js already enforces for an individual set's score (see
// isFirstAttempt there). Kept as one shared base filter so every view
// (ranking, rank-change, per-user stats, the monthly archive) can never
// disagree with each other.
const BASE_ATTEMPT_FILTER = { isFirstAttempt: true, status: "completed" };

// Games are the opposite rule: EVERY completed game attempt counts, each
// time, with its own score — there is no first-attempt restriction. A
// completed GameAttempt is one immutable row (completion is a one-way atomic
// transition in game.service.js), so aggregating over them can never count
// the same attempt twice, and an unfinished/abandoned attempt (status
// "playing") is never included.
const GAME_ATTEMPT_FILTER = { status: "completed" };

function startOfDay(referenceDate) {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  start.setHours(0, 0, 0, 0);
  return start;
}

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
  if (period === "today") {
    return { completedAt: { $gte: startOfDay(referenceDate), $lte: referenceDate } };
  }
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
// whenever there's no well-defined previous window to compare against
// (e.g. a closed "month" cycle) — see rankChangeFor below, which never
// invents movement when this is null.
function previousPeriodDateMatch(period, referenceDate = new Date()) {
  if (period === "today") {
    const todayStart = startOfDay(referenceDate);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    return { completedAt: { $gte: yesterdayStart, $lt: todayStart } };
  }
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

// Sums every qualifying attempt (within the given date window) per user
// from one source collection, joins in the user's profile fields, and —
// critically — drops admin/moderator accounts at the query stage, not just
// hidden afterward in the response, so they can never occupy a rank or count
// toward a participant total.
async function sourceRows(Model, baseFilter, dateMatch, scopeIds) {
  const match = { ...baseFilter, ...dateMatch };
  if (scopeIds) match.userId = { $in: scopeIds };

  return Model.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$userId",
        points: { $sum: "$score" },
        correctCount: { $sum: "$correctCount" },
        wrongCount: { $sum: "$wrongCount" },
        attempted: { $sum: 1 },
      },
    },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
    { $match: { "user.role": "user", "user.accountStatus": { $nin: ["banned", "deleted"] } } },
    {
      $project: {
        userId: "$_id",
        fullName: "$user.fullName",
        avatar: "$user.avatar",
        currentCity: "$user.currentCity",
        points: 1,
        correctCount: 1,
        wrongCount: 1,
        attempted: 1,
      },
    },
  ]);
}

// Tic-Tac-Toe wins are Games points too: every WON game carries the reward that was
// written atomically when it was won (see TicTacToeGame / ticTacToe.service.js),
// so summing them can never count a win twice. Draws, losses and abandoned
// games carry 0 and are excluded. `dateMatch` is the shared period filter
// (keyed on `completedAt`); here the same window applies to `finishedAt`.
async function ticTacToeRows(dateMatch, scopeIds) {
  const match = { status: "won", rewardPoints: { $gt: 0 } };
  if (dateMatch.completedAt) match.finishedAt = dateMatch.completedAt;
  if (scopeIds) match.winnerId = { $in: scopeIds };

  return TicTacToeGame.aggregate([
    { $match: match },
    { $group: { _id: "$winnerId", points: { $sum: "$rewardPoints" }, wins: { $sum: 1 } } },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
    { $match: { "user.role": "user", "user.accountStatus": { $nin: ["banned", "deleted"] } } },
    {
      $project: {
        userId: "$_id",
        fullName: "$user.fullName",
        avatar: "$user.avatar",
        currentCity: "$user.currentCity",
        points: 1,
        correctCount: { $literal: 0 },
        wrongCount: { $literal: 0 },
        attempted: "$wins",
      },
    },
  ]);
}

// Friend quiz challenges: ONLY the winner of a completed match earns points —
// their positive score, written atomically when the match finished
// (rewardPoints). Losers, draws, abandoned matches and matches the loser never
// played carry 0 and are excluded. Same period window as the other Games rows.
async function challengeRows(dateMatch, scopeIds) {
  const match = { status: "completed", winnerId: { $ne: null }, rewardPoints: { $gt: 0 } };
  if (dateMatch.completedAt) match.finishedAt = dateMatch.completedAt;
  if (scopeIds) match.winnerId = { $in: scopeIds };

  return GameChallengeMatch.aggregate([
    { $match: match },
    { $group: { _id: "$winnerId", points: { $sum: "$rewardPoints" }, wins: { $sum: 1 } } },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
    { $match: { "user.role": "user", "user.accountStatus": { $nin: ["banned", "deleted"] } } },
    {
      $project: {
        userId: "$_id",
        fullName: "$user.fullName",
        avatar: "$user.avatar",
        currentCity: "$user.currentCity",
        points: 1,
        correctCount: { $literal: 0 },
        wrongCount: { $literal: 0 },
        attempted: "$wins",
      },
    },
  ]);
}

// Ludo: every finished, legitimately rewarded match carries the points each player
// earned, written atomically when the match finished (rankings[].rewardPoints —
// see LudoGame / ludo.service.js), so summing them can never count a match twice.
// Forfeits, draws and abandoned matches carry 0. Same period window as the other Games rows.
async function ludoRows(dateMatch, scopeIds) {
  const match = { status: "finished", rewardsGranted: true };
  if (dateMatch.completedAt) match.finishedAt = dateMatch.completedAt;
  const rowMatch = { "rankings.rewardPoints": { $gt: 0 } };
  if (scopeIds) rowMatch["rankings.userId"] = { $in: scopeIds };

  return LudoGame.aggregate([
    { $match: match },
    { $unwind: "$rankings" },
    { $match: rowMatch },
    { $group: { _id: "$rankings.userId", points: { $sum: "$rankings.rewardPoints" }, wins: { $sum: { $cond: [{ $eq: ["$rankings.rank", 1] }, 1, 0] } }, matches: { $sum: 1 } } },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
    { $match: { "user.role": "user", "user.accountStatus": { $nin: ["banned", "deleted"] } } },
    {
      $project: {
        userId: "$_id",
        fullName: "$user.fullName",
        avatar: "$user.avatar",
        currentCity: "$user.currentCity",
        points: 1,
        correctCount: { $literal: 0 },
        wrongCount: { $literal: 0 },
        attempted: "$matches",
      },
    },
  ]);
}

// Adds the Tic-Tac-Toe, friend-challenge and Ludo rows into the Games rows, per user.
function mergeGameRows(gameRows, ...extraRowSets) {
  const byUser = new Map(gameRows.map((row) => [row.userId.toString(), { ...row }]));
  for (const row of extraRowSets.flat()) {
    const key = row.userId.toString();
    const existing = byUser.get(key);
    if (existing) {
      existing.points += row.points;
      existing.attempted += row.attempted;
    } else {
      byUser.set(key, { ...row });
    }
  }
  return [...byUser.values()];
}

const EMPTY_PART = { points: 0, correctCount: 0, wrongCount: 0, attempted: 0 };
const partOf = (row) => ({
  points: row.points,
  correctCount: row.correctCount,
  wrongCount: row.wrongCount,
  attempted: row.attempted,
});

// Ranks participants for one category:
//   "quiz"    — completed FIRST quiz attempts only (unchanged rule)
//   "games"   — every completed game attempt
//   "overall" — quiz points + game points, per user
// Ranks are assigned only after every exclusion, so the sequence is always
// contiguous (1, 2, 3, …) with no gaps left by a removed user.
//
// `requesterId` is optional — pass null/undefined for a viewer-independent
// snapshot (friends scoping and block-filtering are both inherently
// relative to a specific viewer, so the monthly archive job calls this
// without one to get one objective, global ranking).
async function rankedParticipants({ category, dateMatch, audience, requesterId }) {
  if (dateMatch === null) return [];

  let scopeIds = null;
  if (audience === "friends" && requesterId) {
    const friendIds = await friendIdsOf(requesterId);
    scopeIds = [...friendIds, requesterId.toString()].map((id) => new mongoose.Types.ObjectId(id));
  }

  const wantsQuiz = category !== "games";
  const wantsGames = category !== "quiz";
  const [quizRows, attemptRows, tttRows, challengeWinRows, ludoPointRows] = await Promise.all([
    wantsQuiz ? sourceRows(QuizAttempt, BASE_ATTEMPT_FILTER, dateMatch, scopeIds) : [],
    wantsGames ? sourceRows(GameAttempt, GAME_ATTEMPT_FILTER, dateMatch, scopeIds) : [],
    wantsGames ? ticTacToeRows(dateMatch, scopeIds) : [],
    wantsGames ? challengeRows(dateMatch, scopeIds) : [],
    wantsGames ? ludoRows(dateMatch, scopeIds) : [],
  ]);
  const gameRows = mergeGameRows(attemptRows, tttRows, challengeWinRows, ludoPointRows);

  const byUser = new Map();
  const entryFor = (row) => {
    const key = row.userId.toString();
    if (!byUser.has(key)) {
      byUser.set(key, {
        userId: row.userId,
        fullName: row.fullName,
        avatar: row.avatar,
        currentCity: row.currentCity,
        quiz: EMPTY_PART,
        games: EMPTY_PART,
      });
    }
    return byUser.get(key);
  };
  quizRows.forEach((row) => { entryFor(row).quiz = partOf(row); });
  gameRows.forEach((row) => { entryFor(row).games = partOf(row); });

  const rows = [...byUser.values()].map((entry) => {
    const parts = category === "quiz" ? [entry.quiz] : category === "games" ? [entry.games] : [entry.quiz, entry.games];
    const sum = (field) => parts.reduce((total, part) => total + part[field], 0);
    return { ...entry, points: sum("points"), correctCount: sum("correctCount"), wrongCount: sum("wrongCount"), attempted: sum("attempted") };
  });

  // Deterministic ranking: total points, then more correct answers as a
  // tie-break, then a stable id order so ties never reorder between requests.
  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.correctCount - a.correctCount ||
      (a.userId.toString() < b.userId.toString() ? -1 : a.userId.toString() > b.userId.toString() ? 1 : 0),
  );

  const blocked = requesterId ? await blockedPairIds(requesterId) : new Set();
  const eligible = rows.filter((row) => !blocked.has(row.userId.toString()));

  return eligible.map((row, index) => ({
    rank: index + 1,
    id: row.userId.toString(),
    fullName: row.fullName,
    avatar: row.avatar || null,
    currentCity: row.currentCity || "",
    points: row.points,
    quizPoints: row.quiz.points,
    gamePoints: row.games.points,
    correctCount: row.correctCount,
    wrongCount: row.wrongCount,
    attempted: row.attempted,
    // Quiz-only counts, so the archive's "Quiz" stats stay quiz-only even
    // when the ranking is the combined overall one.
    quizCorrectCount: row.quiz.correctCount,
    quizWrongCount: row.quiz.wrongCount,
    quizAttempted: row.quiz.attempted,
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
  BASE_ATTEMPT_FILTER,
  GAME_ATTEMPT_FILTER,
  periodDateMatch,
  previousPeriodDateMatch,
  rankedParticipants,
  rankChangeFor,
  nextRankInfo,
};
