// The Leaderboard's monthly cycle boundaries — pure date arithmetic, no DB
// access, so both the live ranking queries and the archive reconciliation
// job derive "is this month active/closed" from the exact same rules.
const { zonedParts, zonedTimeToUtc } = require("../utils/timezone");

const CYCLE_START_HOUR = 8; // new cycle begins 8:00 AM on the 1st
const FINALIZE_HOUR = 16; // month finalizes/archives at 4:00 PM on the last day

function daysInMonth(year, month) {
  // Day 0 of "next month" is the last day of `month` (1-12).
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function cycleStartInstant(year, month) {
  return zonedTimeToUtc(year, month, 1, CYCLE_START_HOUR, 0);
}

function finalizationInstant(year, month) {
  return zonedTimeToUtc(year, month, daysInMonth(year, month), FINALIZE_HOUR, 0);
}

function previousMonthOf(year, month) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function nextMonthOf(year, month) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

// Everything about "where are we in the monthly cycle right now" is
// derived purely from the current instant — nothing is stored as mutable
// "current state" in the database, so there's no state to desync or
// corrupt across a restart.
//
// Returns either:
//   { status: "active", year, month, closesAt }
//   { status: "closed", year: null, month: null, closedYear, closedMonth, opensAt, closesAt }
function getCycleStatus(referenceDate = new Date()) {
  const { year, month } = zonedParts(referenceDate);
  const cycleStart = cycleStartInstant(year, month);
  const finalize = finalizationInstant(year, month);

  if (referenceDate < cycleStart) {
    // Before this month's cycle has even opened — we're still in the
    // closed window left over from the previous month's finalization.
    const prev = previousMonthOf(year, month);
    return {
      status: "closed",
      year: null,
      month: null,
      closedYear: prev.year,
      closedMonth: prev.month,
      opensAt: cycleStart,
      closesAt: finalizationInstant(prev.year, prev.month),
    };
  }

  if (referenceDate < finalize) {
    return { status: "active", year, month, closesAt: finalize };
  }

  const next = nextMonthOf(year, month);
  return {
    status: "closed",
    year: null,
    month: null,
    closedYear: year,
    closedMonth: month,
    opensAt: cycleStartInstant(next.year, next.month),
    closesAt: finalize,
  };
}

module.exports = {
  CYCLE_START_HOUR,
  FINALIZE_HOUR,
  daysInMonth,
  cycleStartInstant,
  finalizationInstant,
  previousMonthOf,
  nextMonthOf,
  getCycleStatus,
};
