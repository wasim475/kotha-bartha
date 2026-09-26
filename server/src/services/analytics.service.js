const User = require("../models/User");
const Post = require("../models/Post");
const Report = require("../models/Report");
const PageView = require("../models/PageView");
const QuizAttempt = require("../models/QuizAttempt");
const GameAttempt = require("../models/GameAttempt");
const GameChallengeMatch = require("../models/GameChallengeMatch");
const TicTacToeGame = require("../models/TicTacToeGame");
const LudoGame = require("../models/LudoGame");
const { GameError } = require("./games/GameError");
const { LEADERBOARD_TIMEZONE, zonedParts, zonedTimeToUtc } = require("../utils/timezone");
const { VISIBLE_CONTENT } = require("../utils/moderation");

// Usage analytics. Recording is a tiny write (one PageView per navigation, updated in
// place by engagement heartbeats); everything an admin sees is aggregated HERE, in
// the database, never by shipping raw events to the browser.

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

// Every key pageKeyFor can produce. A client may name a page directly (pageKey) but
// only from this vocabulary, so nothing free-form is ever stored.
const PAGE_KEYS = new Set([...PAGE_RULES.map(([, key]) => key), "other"]);
const DEVICES = new Set(["mobile", "tablet", "desktop"]);

function resolvePage({ pageKey, path }) {
  if (pageKey !== undefined && pageKey !== null) {
    if (typeof pageKey !== "string" || !PAGE_KEYS.has(pageKey)) throw new GameError(400, "VALIDATION_ERROR", "Invalid page.");
    return pageKey;
  }
  return pageKeyFor(path);
}

const SESSION_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const cleanDevice = (device) => (DEVICES.has(device) ? device : undefined);
const isDuplicateKey = (error) => error?.code === 11000;

// Upsert of one tracked visit. Returns whether it inserted (true) or the visit already
// existed, including when the id belongs to somebody else's visit (nothing is written).
async function upsertView(filter, update) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await PageView.updateOne(filter, update, { upsert: true });
      return result.upsertedCount > 0;
    } catch (error) {
      // Two first-writes raced (or the id is another session's): retry once, then stop.
      if (!isDuplicateKey(error)) throw error;
    }
  }
  return false;
}

// Records one page view. Without a viewId (older clients) duplicates (same session and
// page within a few seconds, e.g. a React re-render) are dropped. With a viewId the write
// is idempotent instead: the same visit can be announced any number of times and stays
// one document, whichever of "entered" and "heartbeat" reaches the server first.
async function recordPageView({ userId, sessionId, path, viewId, device }) {
  if (!SESSION_PATTERN.test(String(sessionId || ""))) throw new GameError(400, "VALIDATION_ERROR", "Invalid session.");
  if (viewId !== undefined && !SESSION_PATTERN.test(String(viewId))) throw new GameError(400, "VALIDATION_ERROR", "Invalid view.");
  const page = pageKeyFor(path);
  const now = new Date();

  if (viewId) {
    const created = await upsertView(
      { viewId, sessionId, userId: userId ? { $in: [null, userId] } : null },
      { $setOnInsert: { userId: userId || null, page, createdAt: now, enteredAt: now, ...(cleanDevice(device) && { device }) } },
    );
    if (!created) return { recorded: false };
  } else {
    const recent = await PageView.exists({ sessionId, page, createdAt: { $gte: new Date(now.getTime() - 3000) } });
    if (recent) return { recorded: false };
    await PageView.create({ userId: userId || null, sessionId, page, createdAt: now });
  }

  // "Last active", at most once every five minutes per user.
  if (userId) {
    await User.updateOne(
      { _id: userId, accountStatus: { $ne: "deleted" }, $or: [{ lastSeenAt: null }, { lastSeenAt: { $lt: new Date(now.getTime() - 5 * 60 * 1000) } }] },
      { $set: { lastSeenAt: now } },
    );
  }
  return { recorded: true };
}

// ---- Engagement (time spent) ------------------------------------------------------
// The browser measures ACTIVE time (tab visible, not idle) and reports it as a running
// total for one visit. The server never trusts it blindly: timestamps are corrected for
// clock skew and must be plausible, the duration can't exceed the wall-clock span it
// claims, one visit is capped, and the stored value only ever grows.

const MAX_VIEW_SECONDS = 4 * 3600; // longest single visit that is counted
const MAX_VIEW_AGE_MS = 12 * 3600 * 1000; // a visit can't have started earlier than this
const MAX_SKEW_MS = 24 * 3600 * 1000; // wildly wrong device clocks are refused
const FUTURE_TOLERANCE_MS = 5000;
const WALL_TOLERANCE_S = 5;

const toMs = (value) => {
  if (typeof value === "string" && !/^\d+$/.test(value)) return Date.parse(value);
  return typeof value === "boolean" || value === null ? NaN : Number(value);
};

const invalid = (message) => new GameError(400, "VALIDATION_ERROR", message);

async function recordEngagement(
  { userId, sessionId, viewId, pageKey, path, enteredAt, lastActivityAt, sentAt, durationSeconds, final, device },
  nowMs = Date.now(),
) {
  if (!SESSION_PATTERN.test(String(sessionId || ""))) throw invalid("Invalid session.");
  if (!SESSION_PATTERN.test(String(viewId || ""))) throw invalid("Invalid view.");
  const page = resolvePage({ pageKey, path });

  const duration = typeof durationSeconds === "number" ? durationSeconds : NaN;
  if (!Number.isFinite(duration) || duration < 0) throw invalid("Invalid duration.");
  if (duration > MAX_VIEW_SECONDS) throw invalid("Duration is too large.");

  // Correct the browser's clock to ours using the moment it sent the request.
  const sent = sentAt === undefined ? nowMs : toMs(sentAt);
  if (!Number.isFinite(sent) || Math.abs(nowMs - sent) > MAX_SKEW_MS) throw invalid("Invalid timestamp.");
  const skew = nowMs - sent;
  const entered = toMs(enteredAt) + skew;
  const last = toMs(lastActivityAt === undefined ? sent : lastActivityAt) + skew;
  if (!Number.isFinite(entered) || !Number.isFinite(last)) throw invalid("Invalid timestamp.");
  if (entered > nowMs + FUTURE_TOLERANCE_MS || last > nowMs + FUTURE_TOLERANCE_MS) throw invalid("Timestamp is in the future.");
  if (last < entered - 1000) throw invalid("Timestamps are out of order.");
  if (nowMs - entered > MAX_VIEW_AGE_MS) throw invalid("Timestamp is too old.");

  // Active time can't be longer than the time the visit has existed.
  const wallSeconds = (Math.min(last, nowMs) - entered) / 1000 + WALL_TOLERANCE_S;
  if (duration > wallSeconds) throw invalid("Duration is longer than the visit.");
  const seconds = Math.min(Math.round(duration), MAX_VIEW_SECONDS);

  const set = { ...(userId && { userId }), ...(final === true && { exitedAt: new Date(nowMs) }), ...(cleanDevice(device) && { device }) };
  const update = {
    $max: { durationSeconds: seconds, lastActivityAt: new Date(Math.min(last, nowMs)) },
    $setOnInsert: { page, enteredAt: new Date(entered), createdAt: new Date(Math.min(entered, nowMs)), ...(userId ? {} : { userId: null }) },
  };
  if (Object.keys(set).length) update.$set = set;

  // Same visit only: matching on the session (and on the user, once known) is what
  // stops one person's ids from being used to write into another's rows.
  await upsertView({ viewId, sessionId, userId: userId ? { $in: [null, userId] } : null }, update);
  return { recorded: true, durationSeconds: seconds };
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

// ---- Engagement aggregates ---------------------------------------------------------
// Only views that carry a duration are "measured": older rows (and visits whose browser
// never reported) have none and are simply left out of the averages — never counted as 0.

const measured = { $cond: [{ $isNumber: "$durationSeconds" }, 1, 0] };
const seconds = { $ifNull: ["$durationSeconds", 0] };
const realUsers = { $size: { $filter: { input: "$users", as: "u", cond: { $ne: ["$$u", null] } } } };
const average = (total, count) => (count > 0 ? total / count : null);

// Totals over one time window (optionally one page).
async function windowStats(from, page) {
  const rows = await PageView.aggregate([
    { $match: { createdAt: { $gte: from }, ...(page && { page }) } },
    { $group: { _id: null, views: { $sum: 1 }, totalSeconds: { $sum: seconds }, measuredViews: { $sum: measured }, sessions: { $addToSet: "$sessionId" }, users: { $addToSet: "$userId" } } },
    { $project: { _id: 0, views: 1, totalSeconds: 1, measuredViews: 1, sessions: { $size: "$sessions" }, users: realUsers } },
  ]);
  const r = rows[0] || { views: 0, totalSeconds: 0, measuredViews: 0, sessions: 0, users: 0 };
  return { ...r, avgSeconds: average(r.totalSeconds, r.measuredViews) };
}

// Median visit length. $percentile needs MongoDB 7+; on older servers it is just omitted.
async function medianSeconds(from) {
  try {
    const rows = await PageView.aggregate([
      { $match: { createdAt: { $gte: from }, durationSeconds: { $type: "number" } } },
      { $group: { _id: null, median: { $percentile: { input: "$durationSeconds", p: [0.5], method: "approximate" } } } },
    ]);
    return rows[0]?.median?.[0] ?? null;
  } catch {
    return null;
  }
}

async function getPageEngagement(from) {
  const rows = await PageView.aggregate([
    { $match: { createdAt: { $gte: from } } },
    { $group: { _id: "$page", views: { $sum: 1 }, totalSeconds: { $sum: seconds }, measuredViews: { $sum: measured }, users: { $addToSet: "$userId" } } },
    { $project: { _id: 0, page: "$_id", views: 1, totalSeconds: 1, measuredViews: 1, users: realUsers } },
    { $sort: { totalSeconds: -1, views: -1 } },
    { $limit: 15 },
  ]);
  return rows.map((row) => ({ ...row, avgSeconds: average(row.totalSeconds, row.measuredViews) }));
}

// One page's numbers for Today / This Week / This Month side by side.
async function getPageAnalytics(page, now = new Date()) {
  if (typeof page !== "string" || !PAGE_KEYS.has(page)) throw new GameError(400, "VALIDATION_ERROR", "Unknown page.");
  const [today, week, month] = await Promise.all(RANGES.map((range) => windowStats(rangeStart(range, now), page)));
  return { page, today, week, month };
}

async function getAnalytics(range) {
  if (!RANGES.includes(range)) range = "today";
  const now = new Date();
  const from = rangeStart(range, now);

  const [totals, series, topPages, newUsers, dau, wau, mau, engagement, pageEngagement, median, activeToday, activeWeek, activeMonth] = await Promise.all([
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
    windowStats(from),
    getPageEngagement(from),
    medianSeconds(from),
    windowStats(rangeStart("today", now)),
    windowStats(rangeStart("week", now)),
    windowStats(rangeStart("month", now)),
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
    // Time spent: active seconds only (tab visible, user not idle).
    engagement: {
      totalSeconds: engagement.totalSeconds,
      measuredViews: engagement.measuredViews,
      avgSeconds: engagement.avgSeconds,
      medianSeconds: median,
      periodTotals: { today: activeToday.totalSeconds, week: activeWeek.totalSeconds, month: activeMonth.totalSeconds },
    },
    pageEngagement,
  };
}

// ---- Dashboard ------------------------------------------------------------------

async function getDashboard() {
  const today = startOfDay();
  const [totalUsers, newToday, totalPosts, pendingReports, pageViewers, seenToday, quizPlayers, gamePlayers, tttPlayers, challengePlayers, ludoPlayers] = await Promise.all([
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
    LudoGame.aggregate([{ $match: { startedAt: { $gte: today } } }, { $unwind: "$participantIds" }, { $group: { _id: "$participantIds" } }]),
  ]);

  const union = (...lists) => new Set(lists.flat().map((item) => String(item?._id ?? item))).size;
  return {
    totalUsers,
    activeToday: union(pageViewers, seenToday),
    newToday,
    totalPosts,
    pendingReports,
    participantsToday: union(quizPlayers, gamePlayers, tttPlayers, challengePlayers, ludoPlayers),
    generatedAt: new Date(),
  };
}

module.exports = { RANGES, PAGE_KEYS, pageKeyFor, recordPageView, recordEngagement, getAnalytics, getPageAnalytics, getDashboard, startOfDay };
