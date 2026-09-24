// Monthly Leaderboard finalization. Deliberately NOT a "fire once at
// exactly 4:00 PM" timer — instead, `reconcileMonthlyArchives` is
// idempotent and safe to call as often as you like: it checks every
// recent month, and for any whose finalization instant has already
// passed and that don't have an archive yet, creates one. Called once at
// server startup (so a period the server was offline across still gets
// archived on the next boot) and then on a plain interval (see
// startLeaderboardArchiveScheduler) — no cron dependency needed, and a
// missed or delayed run just means the archive appears a little later,
// never lost or duplicated.
const LeaderboardArchive = require("../models/LeaderboardArchive");
const { zonedParts } = require("../utils/timezone");
const { cycleStartInstant, finalizationInstant, previousMonthOf } = require("./leaderboardCycle.service");
const { rankedParticipants } = require("./leaderboardRanking.service");

// How many months back to double-check on every reconciliation pass —
// covers even a long server outage spanning more than one missed
// month-end without needing to scan the entire archive history.
const RECONCILE_LOOKBACK_MONTHS = 3;
const RECONCILE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

async function archiveMonthIfDue(year, month, now) {
  const finalize = finalizationInstant(year, month);
  if (now < finalize) return; // this month hasn't finalized yet — nothing to do

  const alreadyArchived = await LeaderboardArchive.exists({ year, month });
  if (alreadyArchived) return; // never recompute/overwrite a finalized month

  const start = cycleStartInstant(year, month);
  // A viewer-independent, global "overall + everyone" snapshot — friends
  // scoping and block-filtering are relative to a specific viewer and
  // don't make sense to bake into a single shared historical record (see
  // leaderboardRanking.service.js's rankedParticipants for the same note).
  const participants = await rankedParticipants({
    category: "overall",
    dateMatch: { completedAt: { $gte: start, $lte: finalize } },
    audience: "everyone",
    requesterId: null,
  });

  try {
    await LeaderboardArchive.create({
      year,
      month,
      periodStart: start,
      periodEnd: finalize,
      totalParticipants: participants.length,
      entries: participants.map((row) => ({
        rank: row.rank,
        userId: row.id,
        fullName: row.fullName,
        avatar: row.avatar,
        currentCity: row.currentCity,
        points: row.points,
        quizPoints: row.quizPoints,
        gamesPoints: row.gamePoints,
        // The archive's stats block is labelled Quiz, so it keeps the quiz-only
        // counts even though `points` is the combined overall total.
        correctCount: row.quizCorrectCount,
        wrongCount: row.quizWrongCount,
        attempted: row.quizAttempted,
      })),
    });
    console.log(`Leaderboard archived for ${year}-${String(month).padStart(2, "0")} (${participants.length} participants).`);
  } catch (error) {
    // Another process (or an overlapping reconciliation tick) already
    // created this month's archive between our exists() check and this
    // create() — the unique {year, month} index caught it, which is
    // exactly the "duplicate execution cannot create duplicate archives"
    // guarantee this is meant to provide. Anything else is a real error.
    if (error.code !== 11000) throw error;
  }
}

async function reconcileMonthlyArchives() {
  const now = new Date();
  const { year, month } = zonedParts(now);

  let cursor = { year, month };
  for (let i = 0; i <= RECONCILE_LOOKBACK_MONTHS; i++) {
    await archiveMonthIfDue(cursor.year, cursor.month, now);
    cursor = previousMonthOf(cursor.year, cursor.month);
  }
}

function startLeaderboardArchiveScheduler() {
  reconcileMonthlyArchives().catch((error) => console.error("Leaderboard archive reconciliation failed:", error));
  const timer = setInterval(() => {
    reconcileMonthlyArchives().catch((error) => console.error("Leaderboard archive reconciliation failed:", error));
  }, RECONCILE_INTERVAL_MS);
  timer.unref?.(); // never keeps the process alive on its own
  return timer;
}

module.exports = { reconcileMonthlyArchives, startLeaderboardArchiveScheduler };
