const User = require("../models/User");
const Post = require("../models/Post");
const Report = require("../models/Report");
const PageView = require("../models/PageView");
const QuizAttempt = require("../models/QuizAttempt");
const GameAttempt = require("../models/GameAttempt");
const GameChallengeMatch = require("../models/GameChallengeMatch");
const TicTacToeGame = require("../models/TicTacToeGame");
const { GameError } = require("./games/GameError");
const { LEADERBOARD_TIMEZONE, zonedParts, zonedTimeToUtc } = require("../utils/timezone");
const { VISIBLE_CONTENT } = require("../utils/moderation");

// Usage analytics. Recording is a tiny append (one PageView per navigation);
// everything an admin sees is aggregated HERE, in the database, never by shipping
// raw events to the browser.

const RANGES = ["today", "week", "month"];
const DAY = 24 * 3600 * 1000;

// ---- Page keys -------------------------------------------------------------
// A URL is reduced to a small fixed vocabulary before it is stored, so ids and
// query strings never reach the analytics collection.
const PAGE_RULES = [
  [/^\/app\/feed/, "feed"],
  [/^\/app\/messages/, "messages"],
  [/^\/app\/friends/, "friends"],
  [/^\/app\/notifications/, "notifications"],
  [/^\/app\/profile/, "profile"],
  [/^\/app\/post/, "post"],
  [/^\/study\/blogs/, "study/blogs"],
  [/^\/study\/quiz/, "study/quiz"],
  [/^\/study\/class-study/, "study/class-study"],
  [/^\/study\/games/, "study/games"],
  [/^\/study\/leaderboard/, "study/leaderboard"],
  [/^\/study/, "study/other"],
  [/^\/admin/, "admin"],
  [/^\/(login|signup)/, "auth"],
];

function pageKeyFor(path) {
  const clean = String(path || "").split("?")[0].split("#")[0].slice(0, 200);
  const rule = PAGE_RULES.find(([pattern]) => pattern.test(clean));
  return rule ? rule[1] : "other";
}

const SESSION_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

// Records one page view. Duplicates (same session and page within a few seconds,
// e.g. a React re-render) are dropped.
async function recordPageView({ userId, sessionId, path }) {
  if (!SESSION_PATTERN.test(String(sessionId || ""))) throw new GameError(400, "VALIDATION_ERROR", "Invalid session.");
  const page = pageKeyFor(path);
  const now = new Date();

  const recent = await PageView.exists({ sessionId, page, createdAt: { $gte: new Date(now.getTime() - 3000) } });
  if (recent) return { recorded: false };
  await PageView.create({ userId: userId || null, sessionId, page, createdAt: now });

  // "Last active", at most once every five minutes per user.
  if (userId) {
    await User.updateOne(
      { _id: userId, accountStatus: { $ne: "deleted" }, $or: [{ lastSeenAt: null }, { lastSeenAt: { $lt: new Date(now.getTime() - 5 * 60 * 1000) } }] },
      { $set: { lastSeenAt: now } },
    );
  }
  return { recorded: true };
}

// ---- Time windows (in the app's own timezone) -------------------------------------

function startOfDay(date = new Date()) {
  const p = zonedParts(date);
  return zonedTimeToUtc(p.year, p.month, p.day, 0, 0);
}

function rangeStart(range, now = new Date()) {
  const today = startOfDay(now);
  if (range === "week") {
    const p = zonedParts(now);
    const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay(); // 0 = Sunday
    return new Date(today.getTime() - ((weekday + 6) % 7) * DAY);
  }
  if (range === "month") {
    const p = zonedParts(now);
    return zonedTimeToUtc(p.year, p.month, 1, 0, 0);
  }
  return today;
}

const distinctUsers = async (since) => {
  const rows = await PageView.aggregate([{ $match: { createdAt: { $gte: since }, userId: { $ne: null } } }, { $group: { _id: "$userId" } }, { $count: "n" }]);
  return rows[0]?.n || 0;
};

async function getAnalytics(range) {
  if (!RANGES.includes(range)) range = "today";
  const now = new Date();
  const from = rangeStart(range, now);

  const [totals, series, topPages, newUsers, dau, wau, mau] = await Promise.all([
    PageView.aggregate([
      { $match: { createdAt: { $gte: from } } },
      { $group: { _id: null, pageViews: { $sum: 1 }, sessions: { $addToSet: "$sessionId" }, users: { $addToSet: "$userId" } } },
      {
        $project: {
          _id: 0,
          pageViews: 1,
          visitors: { $size: "$sessions" },
          activeUsers: { $size: { $filter: { input: "$users", as: "u", cond: { $ne: ["$$u", null] } } } },
        },
      },
    ]),
    PageView.aggregate([
      { $match: { createdAt: { $gte: from } } },
      {
        $group: {
          _id: { $dateToString: { format: range === "today" ? "%H:00" : "%Y-%m-%d", date: "$createdAt", timezone: LEADERBOARD_TIMEZONE } },
          pageViews: { $sum: 1 },
          users: { $addToSet: "$userId" },
        },
      },
      { $project: { _id: 0, bucket: "$_id", pageViews: 1, activeUsers: { $size: { $filter: { input: "$users", as: "u", cond: { $ne: ["$$u", null] } } } } } },
      { $sort: { bucket: 1 } },
    ]),
    PageView.aggregate([
      { $match: { createdAt: { $gte: from } } },
      { $group: { _id: "$page", views: { $sum: 1 }, users: { $addToSet: "$userId" } } },
      { $project: { _id: 0, page: "$_id", views: 1, users: { $size: { $filter: { input: "$users", as: "u", cond: { $ne: ["$$u", null] } } } } } },
      { $sort: { views: -1 } },
      { $limit: 12 },
    ]),
    User.countDocuments({ createdAt: { $gte: from }, accountStatus: { $ne: "deleted" } }),
    distinctUsers(new Date(now.getTime() - DAY)),
    distinctUsers(new Date(now.getTime() - 7 * DAY)),
    distinctUsers(new Date(now.getTime() - 30 * DAY)),
  ]);

  const t = totals[0] || { pageViews: 0, visitors: 0, activeUsers: 0 };
  return {
    range,
    from,
    timezone: LEADERBOARD_TIMEZONE,
    totals: { pageViews: t.pageViews, visitors: t.visitors, activeUsers: t.activeUsers, newUsers },
    active: { daily: dau, weekly: wau, monthly: mau },
    series,
    topPages,
  };
}

// ---- Dashboard ------------------------------------------------------------------

async function getDashboard() {
  const today = startOfDay();
  const [totalUsers, newToday, totalPosts, pendingReports, pageViewers, seenToday, quizPlayers, gamePlayers, tttPlayers, challengePlayers] = await Promise.all([
    User.countDocuments({ accountStatus: { $ne: "deleted" } }),
    User.countDocuments({ createdAt: { $gte: today }, accountStatus: { $ne: "deleted" } }),
    Post.countDocuments({ deletedAt: null, ...VISIBLE_CONTENT }),
    Report.countDocuments({ status: "pending" }),
    PageView.distinct("userId", { createdAt: { $gte: today }, userId: { $ne: null } }),
    User.distinct("_id", { lastSeenAt: { $gte: today }, accountStatus: { $ne: "deleted" } }),
    QuizAttempt.distinct("userId", { createdAt: { $gte: today } }),
    GameAttempt.distinct("userId", { startedAt: { $gte: today } }),
    TicTacToeGame.aggregate([{ $match: { createdAt: { $gte: today } } }, { $project: { p: ["$playerX", "$playerO"] } }, { $unwind: "$p" }, { $group: { _id: "$p" } }]),
    GameChallengeMatch.aggregate([{ $match: { createdAt: { $gte: today } } }, { $unwind: "$playerIds" }, { $group: { _id: "$playerIds" } }]),
  ]);

  const union = (...lists) => new Set(lists.flat().map((item) => String(item?._id ?? item))).size;
  return {
    totalUsers,
    activeToday: union(pageViewers, seenToday),
    newToday,
    totalPosts,
    pendingReports,
    participantsToday: union(quizPlayers, gamePlayers, tttPlayers, challengePlayers),
    generatedAt: new Date(),
  };
}

module.exports = { RANGES, pageKeyFor, recordPageView, getAnalytics, getDashboard, startOfDay };
