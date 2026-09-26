// The configurable rule set. Nothing here is hard-coded into the engine or the UI:
// a variant (variants.js) overrides any of these, and the engine reads only the
// resolved copy stored in the game state.

const { DEFAULT_SAFE_CELLS, TRACK_LENGTH } = require("./board");

const DEFAULT_RULES = Object.freeze({
  // Rolling a six gives the same player another roll.
  extraTurnOnSix: true,
  // The Nth six in a row forfeits that roll (no move, turn passes). 0 = unlimited.
  maxConsecutiveSixes: 3,
  // Dice values that let a token leave the base.
  releaseRolls: Object.freeze([6]),
  // Absolute track cells where a token cannot be captured.
  safeCells: DEFAULT_SAFE_CELLS,
  // If false, a token on a safe cell can still be captured (the cell protects nobody).
  safeCellsProtect: true,
  // A token must land on Home exactly; a roll that would overshoot is not a legal move.
  exactHome: true,
  // Bonus roll after capturing / after bringing a token Home.
  extraTurnOnCapture: true,
  extraTurnOnHome: true,
  // When exactly one token can move, move it automatically (no tap needed).
  autoMoveSingleLegal: true,

  // ---- Timing (ms). The SERVER's clock is the only one that counts.
  // 0 = no time limit (the default: nobody is hurried). Set it, per variant or here,
  // to give every turn a server-side deadline with automatic play.
  turnTimeMs: 0,
  // Time the "3-2-1-GO" countdown takes before the first turn can start.
  countdownMs: 3600,
  // Consecutive automatic (timed-out) turns before a player is treated as away.
  maxTimeoutsBeforeForfeit: 3,
  // How long a disconnected player may take to come back before forfeiting.
  disconnectGraceMs: 45000,
  // Safety net so a game can never run forever.
  maxTurns: 1500,

  // How players who did not finish are ranked when a ranked game ends early.
  //   "progress": more tokens home, then further-advanced tokens, first
  remainingRankBy: "progress",
});

const NUMBER_KEYS = ["maxConsecutiveSixes", "turnTimeMs", "countdownMs", "maxTimeoutsBeforeForfeit", "disconnectGraceMs", "maxTurns"];
const BOOLEAN_KEYS = ["extraTurnOnSix", "safeCellsProtect", "exactHome", "extraTurnOnCapture", "extraTurnOnHome", "autoMoveSingleLegal"];

// Merges variant overrides onto the defaults and validates the result.
function resolveRules(overrides = {}) {
  const rules = { ...DEFAULT_RULES, ...overrides };

  for (const key of NUMBER_KEYS) {
    if (!Number.isFinite(rules[key]) || rules[key] < 0) throw new RangeError(`Ludo rule ${key} must be a non-negative number.`);
  }
  for (const key of BOOLEAN_KEYS) {
    if (typeof rules[key] !== "boolean") throw new TypeError(`Ludo rule ${key} must be true or false.`);
  }
  if (!Array.isArray(rules.releaseRolls) || rules.releaseRolls.some((value) => !Number.isInteger(value) || value < 1 || value > 6)) {
    throw new RangeError("Ludo rule releaseRolls must be a list of dice values (1-6).");
  }
  if (!Array.isArray(rules.safeCells) || rules.safeCells.some((cell) => !Number.isInteger(cell) || cell < 0 || cell >= TRACK_LENGTH)) {
    throw new RangeError("Ludo rule safeCells must be a list of track cells.");
  }
  if (rules.remainingRankBy !== "progress") throw new RangeError("Ludo rule remainingRankBy must be \"progress\".");

  return Object.freeze({ ...rules, releaseRolls: Object.freeze([...rules.releaseRolls]), safeCells: Object.freeze([...rules.safeCells]) });
}

module.exports = { DEFAULT_RULES, resolveRules };
