// The ONE registry of Ludo game modes. Everything mode-specific — how many
// players, how it is won, whether it is ranked / rewarded / online — is declared
// here and read by the engine, the server and the UI. Nothing else in the code
// base branches on a specific mode id, so a new mode is one new entry.

const WIN_RULES = Object.freeze({
  // The first player to capture ANY opponent token wins at once.
  FIRST_CAPTURE: "FIRST_CAPTURE",
  // A player wins as soon as they have BOTH captured a token AND brought one of their own Home.
  CAPTURE_AND_HOME: "CAPTURE_AND_HOME",
  // Classic: bring all four tokens Home; players are ranked in the order they finish.
  RANKED_HOME: "RANKED_HOME",
});

// Points / XP by number of players, then by final rank (index 0 = 1st place).
// Non-ranked modes have two placements: 1 = winner, 2 = everyone else.
const rewardTable = (points, xp) => Object.freeze({ points: Object.freeze(points), xp: Object.freeze(xp), coins: 0 });

const VARIANTS = Object.freeze({
  QUICK_CAPTURE: Object.freeze({
    id: "QUICK_CAPTURE",
    title: "Quick Ludo",
    description: "The first player to capture an opponent's token wins — the match ends immediately.",
    category: "ludo",
    minPlayers: 2,
    maxPlayers: 4,
    tokenCount: 4,
    winningRule: WIN_RULES.FIRST_CAPTURE,
    rulesSummary: ["Roll a 6 to bring a token out.", "Land on an opponent's token (not on a safe cell) to capture it.", "First capture wins the match."],
    online: true,
    local: false,
    rankingEnabled: false,
    leaderboardEnabled: true,
    enabled: true,
    timer: Object.freeze({ turnMs: 20000, warnAtSeconds: Object.freeze([10, 5, 3, 2, 1]) }),
    rules: Object.freeze({ turnTimeMs: 20000 }),
    rewards: rewardTable({ 2: [3, 0], 3: [4, 0, 0], 4: [5, 0, 0, 0] }, { 2: [25, 8], 3: [30, 8, 8], 4: [35, 8, 8, 8] }),
  }),

  CAPTURE_AND_HOME: Object.freeze({
    id: "CAPTURE_AND_HOME",
    title: "Capture + Home",
    description: "Capture at least one opponent token AND bring one of your own tokens Home to win.",
    category: "ludo",
    minPlayers: 2,
    maxPlayers: 4,
    tokenCount: 4,
    winningRule: WIN_RULES.CAPTURE_AND_HOME,
    rulesSummary: ["Capture at least one opponent token.", "Bring at least one of your own tokens Home.", "Do both to win the match."],
    online: true,
    local: false,
    rankingEnabled: false,
    leaderboardEnabled: true,
    enabled: true,
    timer: Object.freeze({ turnMs: 25000, warnAtSeconds: Object.freeze([10, 5, 3, 2, 1]) }),
    rules: Object.freeze({ turnTimeMs: 25000 }),
    rewards: rewardTable({ 2: [5, 0], 3: [6, 0, 0], 4: [8, 0, 0, 0] }, { 2: [35, 10], 3: [40, 10, 10], 4: [45, 10, 10, 10] }),
  }),

  CLASSIC_RANKED: Object.freeze({
    id: "CLASSIC_RANKED",
    title: "Classic Ranked Ludo",
    description: "Bring all four tokens Home. Players are ranked 1st to 4th in the order they finish.",
    category: "ludo",
    minPlayers: 2,
    maxPlayers: 4,
    tokenCount: 4,
    winningRule: WIN_RULES.RANKED_HOME,
    rulesSummary: ["Bring all four tokens Home.", "Finish order decides 1st, 2nd, 3rd and 4th.", "The last player still playing takes the final place."],
    online: true,
    local: false,
    rankingEnabled: true,
    leaderboardEnabled: true,
    enabled: true,
    timer: Object.freeze({ turnMs: 30000, warnAtSeconds: Object.freeze([10, 5, 3, 2, 1]) }),
    rules: Object.freeze({ turnTimeMs: 30000 }),
    rewards: rewardTable({ 2: [6, 0], 3: [8, 4, 0], 4: [10, 6, 3, 0] }, { 2: [40, 12], 3: [45, 25, 12], 4: [50, 30, 18, 10] }),
  }),

  LOCAL_CLASSIC: Object.freeze({
    id: "LOCAL_CLASSIC",
    title: "Local Ludo",
    description: "Four friends, one device. Classic rules: bring all four tokens Home.",
    category: "ludo",
    minPlayers: 4,
    maxPlayers: 4,
    tokenCount: 4,
    winningRule: WIN_RULES.RANKED_HOME,
    rulesSummary: ["Pass the device around.", "Bring all four tokens Home.", "Finish order decides the ranking."],
    online: false,
    local: true,
    rankingEnabled: true,
    leaderboardEnabled: false,
    enabled: true,
    // No turn timer and no countdown: everyone is sitting at the same screen.
    timer: null,
    rules: Object.freeze({ turnTimeMs: 0, countdownMs: 0, maxTimeoutsBeforeForfeit: 0, disconnectGraceMs: 0 }),
    rewards: null,
  }),
});

const VARIANT_IDS = Object.freeze(Object.keys(VARIANTS));
const getVariant = (id) => VARIANTS[id] || null;
const listVariants = () => VARIANT_IDS.map((id) => VARIANTS[id]);
const listOnlineVariants = () => listVariants().filter((variant) => variant.online);

// { points, xp, coins } for a finished player. Unknown / unrewarded modes give zeros.
function rewardFor(variant, playerCount, rank) {
  const table = variant?.rewards;
  const zero = { points: 0, xp: 0, coins: 0 };
  if (!table || !Number.isInteger(rank) || rank < 1) return zero;
  const points = table.points[playerCount];
  const xp = table.xp[playerCount];
  if (!points || !xp) return zero;
  const index = Math.min(rank, points.length) - 1;
  return { points: points[index] ?? 0, xp: xp[index] ?? 0, coins: table.coins || 0 };
}

module.exports = { WIN_RULES, VARIANTS, VARIANT_IDS, getVariant, listVariants, listOnlineVariants, rewardFor };
