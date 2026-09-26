// The Ludo rules engine — the single source of truth for how Ludo is played.
//
//   applyAction(state, action, { now }) -> { ok, state, events } | { ok: false, error }
//
// PURE and DETERMINISTIC: no React, no Socket.IO, no MongoDB, no clock, no
// Math.random. The current time comes in as `ctx.now`; dice come from the
// generator state stored in the game state itself. The same state + action +
// time therefore always produces the same result, which is what lets one engine
// serve the authoritative server (online), the browser (local mode, and
// animating the server's results) and the tests. The input state is never
// mutated.
//
// The client never says where a token is or what was rolled. It only expresses
// an intention — ROLL_DICE, SELECT_TOKEN { tokenId } — and the engine decides.

const {
  TOKENS_PER_PLAYER,
  FINISH,
  IN_BASE,
  SEATS_FOR_PLAYERS,
  SEAT_COLORS,
  isInBase,
  isFinished,
  isOnTrack,
  absoluteCell,
} = require("./board");
const { resolveRules } = require("./rules");
const { getVariant, WIN_RULES } = require("./variants");
const { rollDie, toUint32 } = require("./rng");

const ACTION = Object.freeze({
  ROLL_DICE: "ROLL_DICE",
  SELECT_TOKEN: "SELECT_TOKEN",
  TIMEOUT: "TIMEOUT",
  LEAVE_GAME: "LEAVE_GAME",
  DISCONNECT: "DISCONNECT",
  RECONNECT: "RECONNECT",
  FORFEIT_DISCONNECTED: "FORFEIT_DISCONNECTED",
  REQUEST_REMATCH: "REQUEST_REMATCH",
});

const EVENT = Object.freeze({
  DICE_ROLLED: "DICE_ROLLED",
  NO_MOVES: "NO_MOVES",
  SIXES_LIMIT: "SIXES_LIMIT",
  TOKEN_EXITED_HOME: "TOKEN_EXITED_HOME", // left the base onto its start cell
  TOKEN_MOVED: "TOKEN_MOVED",
  TOKEN_CAPTURED: "TOKEN_CAPTURED",
  TOKEN_FINISHED: "TOKEN_FINISHED", // reached Home
  EXTRA_TURN: "EXTRA_TURN",
  TURN_CHANGED: "TURN_CHANGED",
  PLAYER_FINISHED: "PLAYER_FINISHED",
  GAME_FINISHED: "GAME_FINISHED",
  DRAW: "DRAW",
  TIMEOUT: "TIMEOUT",
  PLAYER_LEFT: "PLAYER_LEFT",
  PLAYER_DISCONNECTED: "PLAYER_DISCONNECTED",
  PLAYER_RECONNECTED: "PLAYER_RECONNECTED",
  REMATCH_REQUESTED: "REMATCH_REQUESTED",
});

const PHASE = Object.freeze({ ROLL: "ROLL", MOVE: "MOVE", FINISHED: "FINISHED" });
const PLAYER_STATUS = Object.freeze({ ACTIVE: "ACTIVE", FINISHED: "FINISHED", LEFT: "LEFT" });
const FINISH_REASON = Object.freeze({
  WIN_CONDITION: "WIN_CONDITION", // the mode's winning condition was met
  RANKING_COMPLETE: "RANKING_COMPLETE", // a ranked game played out
  FORFEIT: "FORFEIT", // everybody else left
  DRAW: "DRAW",
});

const RECENT_ACTION_IDS = 24;

const clone = (value) => JSON.parse(JSON.stringify(value));
const fail = (state, code, message) => ({ ok: false, state, events: [], error: { code, message } });

// ---- Lookups ------------------------------------------------------------------------

const playerBySeat = (state, seat) => state.players.find((player) => player.seat === seat) || null;
const tokensHome = (player) => player.tokens.filter((token) => isFinished(token.pos)).length;
const progressOf = (player) => tokensHome(player) * 1000 + player.tokens.reduce((sum, token) => sum + Math.max(0, token.pos), 0);
const contendersOf = (state) => state.players.filter((player) => player.status !== PLAYER_STATUS.LEFT);
const unfinishedOf = (state) => state.players.filter((player) => player.status === PLAYER_STATUS.ACTIVE);

// ---- Creating a game ------------------------------------------------------------------

/**
 * @param {object} input
 * @param {string} input.variantId      key of the variants registry
 * @param {Array<{userId?: string, name: string}>} input.players  in seating order
 * @param {number} input.seed           any integer; online games use a secret crypto seed
 * @param {number} [input.now]          ms timestamp the game starts at
 * @param {object} [input.rules]        overrides applied on top of the variant's rules
 * @param {number} [input.firstSeat]    seat that moves first (default: the first player's)
 */
function createGame({ variantId, players, seed, now = 0, rules: overrides = {}, firstSeat = null }) {
  const variant = getVariant(variantId);
  if (!variant) throw new RangeError(`Unknown Ludo variant: ${variantId}`);
  if (!Array.isArray(players) || players.length < variant.minPlayers || players.length > variant.maxPlayers) {
    throw new RangeError(`${variant.title} needs ${variant.minPlayers}-${variant.maxPlayers} players.`);
  }
  if (!Number.isInteger(seed)) throw new TypeError("A Ludo game needs an integer seed.");

  const seats = SEATS_FOR_PLAYERS[players.length];
  const rules = resolveRules({ ...variant.rules, ...overrides });

  const seated = players.map((input, index) => ({
    seat: seats[index],
    userId: input.userId ? String(input.userId) : null,
    name: String(input.name || `Player ${index + 1}`).trim().slice(0, 24) || `Player ${index + 1}`,
    color: SEAT_COLORS[seats[index]],
    status: PLAYER_STATUS.ACTIVE,
    leftReason: null,
    leftAt: null,
    rank: null,
    connected: true,
    disconnectedAt: null,
    timeouts: 0,
    timeoutsTotal: 0,
    captures: 0,
    capturedCount: 0,
    hasCaptured: false,
    tokens: Array.from({ length: TOKENS_PER_PLAYER }, (_, id) => ({ id, pos: IN_BASE })),
  }));

  const startSeat = firstSeat !== null && seated.some((player) => player.seat === firstSeat) ? firstSeat : seated[0].seat;
  const startsAt = now + rules.countdownMs;

  return {
    version: 0,
    variantId,
    rules,
    phase: PHASE.ROLL,
    order: seats.slice(),
    players: seated,
    startsAt,
    firstSeat: startSeat,
    turnSeat: startSeat,
    turnNumber: 1,
    turnStartedAt: startsAt,
    turnDeadline: rules.turnTimeMs > 0 ? startsAt + rules.turnTimeMs : null,
    dice: null,
    legal: [],
    consecutiveSixes: 0,
    rollCount: 0,
    moveCount: 0,
    finishOrder: [],
    winnerSeat: null,
    rankings: null,
    finishReason: null,
    finishedAt: null,
    captures: [],
    rematchRequests: [],
    actionIds: [],
    rng: toUint32(seed),
  };
}

// What may be shown to clients: everything except the dice generator's state
// (which would let someone predict the next roll) and the replay-protection list.
function publicState(state) {
  const { rng, actionIds, ...visible } = state; // eslint-disable-line no-unused-vars
  return clone(visible);
}

// ---- Legal moves ------------------------------------------------------------------------

const isSafe = (rules, cell) => rules.safeCellsProtect && rules.safeCells.includes(cell);

// Opponent tokens standing on an absolute track cell (players who left are off the board).
function opponentsOnCell(state, seat, cell) {
  const found = [];
  for (const player of state.players) {
    if (player.seat === seat || player.status === PLAYER_STATUS.LEFT) continue;
    for (const token of player.tokens) {
      if (absoluteCell(player.seat, token.pos) === cell) found.push({ seat: player.seat, tokenId: token.id });
    }
  }
  return found;
}

/**
 * Every token that can legally move with this dice value, with where it would
 * land, the cells it crosses (for animation) and whom it would capture.
 */
function computeLegalMoves(state, seat, dice) {
  const player = playerBySeat(state, seat);
  if (!player) return [];
  const { rules } = state;
  const moves = [];

  for (const token of player.tokens) {
    if (isFinished(token.pos)) continue;

    let to;
    let kind;
    if (isInBase(token.pos)) {
      if (!rules.releaseRolls.includes(dice)) continue;
      to = 0;
      kind = "EXIT";
    } else {
      to = token.pos + dice;
      if (to > FINISH) {
        if (rules.exactHome) continue; // would overshoot Home
        to = FINISH;
      }
      kind = to === FINISH ? "HOME" : "STEP";
    }

    const path = [];
    for (let step = isInBase(token.pos) ? 0 : token.pos + 1; step <= to; step++) path.push(step);

    let captures = [];
    if (isOnTrack(to)) {
      const cell = absoluteCell(seat, to);
      if (!isSafe(rules, cell)) captures = opponentsOnCell(state, seat, cell);
    }
    moves.push({ tokenId: token.id, from: token.pos, to, kind, path, captures });
  }
  return moves;
}

// ---- Turn flow ------------------------------------------------------------------------------

function nextActiveSeat(state, fromSeat) {
  const { order } = state;
  const start = order.indexOf(fromSeat);
  for (let offset = 1; offset <= order.length; offset++) {
    const seat = order[(start + offset) % order.length];
    if (playerBySeat(state, seat)?.status === PLAYER_STATUS.ACTIVE) return seat;
  }
  return null;
}

function armTurn(draft, seat, now) {
  draft.turnSeat = seat;
  draft.phase = PHASE.ROLL;
  draft.dice = null;
  draft.legal = [];
  draft.turnStartedAt = now;
  draft.turnDeadline = draft.rules.turnTimeMs > 0 ? now + draft.rules.turnTimeMs : null;
}

function endTurn(draft, events, now) {
  draft.consecutiveSixes = 0;
  const next = nextActiveSeat(draft, draft.turnSeat);
  if (next === null) return finishGame(draft, events, now, { winnerSeat: null, reason: FINISH_REASON.DRAW });
  draft.turnNumber += 1;
  if (draft.turnNumber > draft.rules.maxTurns) return finishGame(draft, events, now, { winnerSeat: null, reason: FINISH_REASON.DRAW });
  armTurn(draft, next, now);
  events.push({ type: EVENT.TURN_CHANGED, seat: next, turnNumber: draft.turnNumber });
  return null;
}

// The same player rolls again.
function grantExtraTurn(draft, events, now, reason) {
  armTurn(draft, draft.turnSeat, now);
  events.push({ type: EVENT.EXTRA_TURN, seat: draft.turnSeat, reason });
}

// ---- Finishing --------------------------------------------------------------------------------

function buildRankings(draft, winnerSeat, reason) {
  const variant = getVariant(draft.variantId);
  const byProgress = (a, b) => progressOf(b) - progressOf(a) || (b.leftAt || 0) - (a.leftAt || 0) || a.seat - b.seat;

  if (variant.winningRule === WIN_RULES.RANKED_HOME) {
    const ranked = draft.finishOrder.map((seat) => playerBySeat(draft, seat));
    const remaining = unfinishedOf(draft).sort(byProgress);
    const left = draft.players.filter((player) => player.status === PLAYER_STATUS.LEFT).sort(byProgress);
    const rows = [
      ...ranked.map((player) => ({ seat: player.seat, result: "FINISHED" })),
      // The player(s) still on the board when the game ended: the last one standing
      // takes the next place, ahead of anybody who walked away.
      ...remaining.map((player) => ({ seat: player.seat, result: reason === FINISH_REASON.FORFEIT ? "WIN" : "FINISHED" })),
      ...left.map((player) => ({ seat: player.seat, result: "FORFEIT" })),
    ];
    return rows.map((row, index) => ({ ...row, rank: index + 1 }));
  }

  // Win-condition modes: one winner, everybody else shares second place.
  return draft.players
    .slice()
    .sort((a, b) => (a.seat === winnerSeat ? -1 : b.seat === winnerSeat ? 1 : byProgress(a, b)))
    .map((player) => ({
      seat: player.seat,
      rank: player.seat === winnerSeat ? 1 : 2,
      result: player.seat === winnerSeat ? "WIN" : player.status === PLAYER_STATUS.LEFT ? "FORFEIT" : "LOSS",
    }));
}

function finishGame(draft, events, now, { winnerSeat, reason }) {
  draft.phase = PHASE.FINISHED;
  draft.dice = null;
  draft.legal = [];
  draft.turnDeadline = null;
  draft.finishedAt = now;
  draft.finishReason = reason;

  if (reason === FINISH_REASON.DRAW) {
    draft.winnerSeat = null;
    draft.rankings = draft.players.map((player) => ({ seat: player.seat, rank: 1, result: "DRAW" }));
    events.push({ type: EVENT.DRAW });
  } else {
    const rankings = buildRankings(draft, winnerSeat, reason);
    draft.rankings = rankings;
    draft.winnerSeat = rankings.find((row) => row.rank === 1)?.seat ?? winnerSeat;
    for (const row of rankings) playerBySeat(draft, row.seat).rank = row.rank;
  }
  events.push({ type: EVENT.GAME_FINISHED, winnerSeat: draft.winnerSeat, reason, rankings: draft.rankings });
  return draft.phase;
}

// Called after every move / departure. Returns true if the game ended.
function checkForEnd(draft, events, now, { mover = null, captured = false, reachedHome = false } = {}) {
  const variant = getVariant(draft.variantId);

  if (variant.winningRule === WIN_RULES.FIRST_CAPTURE) {
    if (captured && mover !== null) {
      finishGame(draft, events, now, { winnerSeat: mover, reason: FINISH_REASON.WIN_CONDITION });
      return true;
    }
  } else if (variant.winningRule === WIN_RULES.CAPTURE_AND_HOME) {
    const player = mover !== null ? playerBySeat(draft, mover) : null;
    if (player && player.hasCaptured && tokensHome(player) >= 1 && (captured || reachedHome)) {
      finishGame(draft, events, now, { winnerSeat: mover, reason: FINISH_REASON.WIN_CONDITION });
      return true;
    }
  }

  // Everyone but one has left: the one still here wins by forfeit.
  const contenders = contendersOf(draft);
  if (contenders.length <= 1) {
    if (contenders.length === 1 && variant.winningRule !== WIN_RULES.RANKED_HOME) {
      finishGame(draft, events, now, { winnerSeat: contenders[0].seat, reason: FINISH_REASON.FORFEIT });
    } else if (contenders.length === 1) {
      finishGame(draft, events, now, {
        winnerSeat: contenders[0].seat,
        reason: draft.finishOrder.length ? FINISH_REASON.RANKING_COMPLETE : FINISH_REASON.FORFEIT,
      });
    } else {
      finishGame(draft, events, now, { winnerSeat: null, reason: FINISH_REASON.DRAW });
    }
    return true;
  }

  // Ranked play: once at most one player still has tokens to bring home, the ranking is complete.
  if (variant.winningRule === WIN_RULES.RANKED_HOME && unfinishedOf(draft).length <= 1) {
    finishGame(draft, events, now, { winnerSeat: draft.finishOrder[0] ?? null, reason: FINISH_REASON.RANKING_COMPLETE });
    return true;
  }
  return false;
}

// ---- Rolling and moving ---------------------------------------------------------------------------

function performMove(draft, events, now, seat, move, { auto = false } = {}) {
  const player = playerBySeat(draft, seat);
  const token = player.tokens.find((candidate) => candidate.id === move.tokenId);
  const dice = draft.dice;

  token.pos = move.to;
  draft.moveCount += 1;
  if (move.kind === "EXIT") {
    events.push({ type: EVENT.TOKEN_EXITED_HOME, seat, tokenId: token.id, to: move.to, auto });
  } else {
    events.push({ type: EVENT.TOKEN_MOVED, seat, tokenId: token.id, from: move.from, to: move.to, path: move.path, auto });
  }

  let captured = false;
  for (const victimRef of move.captures) {
    const victimPlayer = playerBySeat(draft, victimRef.seat);
    const victimToken = victimPlayer.tokens.find((candidate) => candidate.id === victimRef.tokenId);
    const victimFrom = victimToken.pos;
    victimToken.pos = IN_BASE;
    victimPlayer.capturedCount += 1;
    player.captures += 1;
    player.hasCaptured = true;
    captured = true;
    draft.captures.push({ by: seat, byTokenId: token.id, victim: victimRef.seat, victimTokenId: victimToken.id, move: draft.moveCount });
    events.push({
      type: EVENT.TOKEN_CAPTURED,
      by: seat,
      byTokenId: token.id,
      victimSeat: victimRef.seat,
      victimTokenId: victimToken.id,
      victimFrom,
      cell: absoluteCell(seat, move.to),
    });
  }

  const reachedHome = move.to === FINISH;
  if (reachedHome) events.push({ type: EVENT.TOKEN_FINISHED, seat, tokenId: token.id });

  // A player with all four tokens Home is done.
  const allHome = tokensHome(player) === TOKENS_PER_PLAYER;
  if (allHome) {
    player.status = PLAYER_STATUS.FINISHED;
    if (getVariant(draft.variantId).winningRule === WIN_RULES.RANKED_HOME) {
      draft.finishOrder.push(seat);
      player.rank = draft.finishOrder.length;
      events.push({ type: EVENT.PLAYER_FINISHED, seat, rank: player.rank });
    } else {
      events.push({ type: EVENT.PLAYER_FINISHED, seat, rank: null });
    }
  }

  if (checkForEnd(draft, events, now, { mover: seat, captured, reachedHome })) return;

  const { rules } = draft;
  const bonus =
    !allHome &&
    ((dice === 6 && rules.extraTurnOnSix) || (captured && rules.extraTurnOnCapture) || (reachedHome && rules.extraTurnOnHome));
  if (bonus) {
    grantExtraTurn(draft, events, now, dice === 6 && rules.extraTurnOnSix ? "SIX" : captured ? "CAPTURE" : "HOME");
  } else {
    endTurn(draft, events, now);
  }
}

function performRoll(draft, events, now, seat, { auto = false } = {}) {
  const roll = rollDie(draft.rng);
  draft.rng = roll.state;
  draft.rollCount += 1;
  const dice = roll.value;
  draft.consecutiveSixes = dice === 6 ? draft.consecutiveSixes + 1 : 0;
  draft.dice = dice;
  events.push({ type: EVENT.DICE_ROLLED, seat, value: dice, auto });

  const { rules } = draft;
  if (dice === 6 && rules.maxConsecutiveSixes > 0 && draft.consecutiveSixes >= rules.maxConsecutiveSixes) {
    events.push({ type: EVENT.SIXES_LIMIT, seat, value: dice });
    endTurn(draft, events, now);
    return;
  }

  const legal = computeLegalMoves(draft, seat, dice);
  if (legal.length === 0) {
    events.push({ type: EVENT.NO_MOVES, seat, value: dice });
    if (dice === 6 && rules.extraTurnOnSix) grantExtraTurn(draft, events, now, "SIX");
    else endTurn(draft, events, now);
    return;
  }

  if (legal.length === 1 && rules.autoMoveSingleLegal) {
    performMove(draft, events, now, seat, legal[0], { auto: true });
    return;
  }

  draft.phase = PHASE.MOVE;
  draft.legal = legal;
}

// A player leaves for good (chose to, timed out too often, or never came back).
function performLeave(draft, events, now, seat, reason) {
  const player = playerBySeat(draft, seat);
  player.status = PLAYER_STATUS.LEFT;
  player.leftReason = reason;
  player.leftAt = now;
  events.push({ type: EVENT.PLAYER_LEFT, seat, reason });

  if (checkForEnd(draft, events, now)) return;
  if (draft.turnSeat === seat) endTurn(draft, events, now);
}

// ---- The action handler ----------------------------------------------------------------------------

function applyAction(state, action, ctx = {}) {
  const now = Number.isFinite(ctx.now) ? ctx.now : 0;

  if (!action || typeof action !== "object" || !ACTION[action.type]) {
    return fail(state, "INVALID_ACTION", "That action isn't recognised.");
  }

  // Replay protection: an action id that was already applied is acknowledged, not applied twice.
  if (action.actionId !== undefined) {
    if (typeof action.actionId !== "string" || action.actionId.length > 64) return fail(state, "INVALID_ACTION", "Invalid action id.");
    if (state.actionIds.includes(action.actionId)) return { ok: true, duplicate: true, state, events: [] };
  }
  if (action.expectedVersion !== undefined && action.expectedVersion !== state.version) {
    return fail(state, "STALE_VERSION", "The game has moved on — syncing.");
  }

  const player = Number.isInteger(action.seat) ? playerBySeat(state, action.seat) : null;

  if (state.phase === PHASE.FINISHED) {
    if (action.type === ACTION.REQUEST_REMATCH) {
      if (!player) return fail(state, "INVALID_PLAYER", "You are not in this game.");
      const draft = clone(state);
      const events = [];
      if (!draft.rematchRequests.includes(player.seat)) draft.rematchRequests.push(player.seat);
      events.push({ type: EVENT.REMATCH_REQUESTED, seat: player.seat });
      return commit(draft, events, action);
    }
    if (action.type === ACTION.RECONNECT || action.type === ACTION.DISCONNECT) return { ok: true, state, events: [] };
    return fail(state, "GAME_FINISHED", "This game is over.");
  }
  if (action.type === ACTION.REQUEST_REMATCH) return fail(state, "GAME_NOT_FINISHED", "Finish this game first.");

  if (!player) return fail(state, "INVALID_PLAYER", "You are not in this game.");
  if (player.status === PLAYER_STATUS.LEFT && action.type !== ACTION.LEAVE_GAME) {
    return fail(state, "PLAYER_LEFT", "You have left this game.");
  }

  const draft = clone(state);
  const events = [];

  switch (action.type) {
    case ACTION.ROLL_DICE: {
      if (now < state.startsAt) return fail(state, "NOT_STARTED", "The game is about to start.");
      if (state.turnSeat !== player.seat) return fail(state, "NOT_YOUR_TURN", "It's not your turn.");
      if (state.phase !== PHASE.ROLL) return fail(state, "ALREADY_ROLLED", "Choose a token to move.");
      playerBySeat(draft, player.seat).timeouts = 0;
      performRoll(draft, events, now, player.seat);
      break;
    }

    case ACTION.SELECT_TOKEN: {
      if (now < state.startsAt) return fail(state, "NOT_STARTED", "The game is about to start.");
      if (state.turnSeat !== player.seat) return fail(state, "NOT_YOUR_TURN", "It's not your turn.");
      if (state.phase !== PHASE.MOVE) return fail(state, "MUST_ROLL", "Roll the dice first.");
      if (!Number.isInteger(action.tokenId) || action.tokenId < 0 || action.tokenId >= TOKENS_PER_PLAYER) {
        return fail(state, "INVALID_TOKEN", "That isn't one of your tokens.");
      }
      const move = state.legal.find((candidate) => candidate.tokenId === action.tokenId);
      if (!move) return fail(state, "ILLEGAL_MOVE", "That token can't move with this roll.");
      playerBySeat(draft, player.seat).timeouts = 0;
      performMove(draft, events, now, player.seat, move);
      break;
    }

    case ACTION.TIMEOUT: {
      // The turn's owner is the one who ran out of time; `seat` on the action is only used to find the game.
      if (state.turnDeadline === null || now < state.turnDeadline) return fail(state, "NOT_EXPIRED", "The turn hasn't run out of time.");
      const seat = state.turnSeat;
      const current = playerBySeat(draft, seat);
      current.timeouts += 1;
      current.timeoutsTotal += 1;
      events.push({ type: EVENT.TIMEOUT, seat, phase: state.phase });

      if (draft.rules.maxTimeoutsBeforeForfeit > 0 && current.timeouts >= draft.rules.maxTimeoutsBeforeForfeit) {
        performLeave(draft, events, now, seat, "AFK");
        break;
      }
      // Deterministic automatic play: roll if the dice weren't rolled, then move
      // the first legal token (lowest token id); no legal move means the turn passes.
      if (draft.phase === PHASE.ROLL) performRoll(draft, events, now, seat, { auto: true });
      if (draft.phase === PHASE.MOVE && draft.turnSeat === seat) {
        const move = draft.legal.slice().sort((a, b) => a.tokenId - b.tokenId)[0];
        performMove(draft, events, now, seat, move, { auto: true });
      }
      break;
    }

    case ACTION.LEAVE_GAME: {
      if (player.status === PLAYER_STATUS.LEFT) return { ok: true, state, events: [] };
      performLeave(draft, events, now, player.seat, action.reason === "DISCONNECT" ? "DISCONNECT" : "LEFT");
      break;
    }

    case ACTION.DISCONNECT: {
      const current = playerBySeat(draft, player.seat);
      if (!current.connected) return { ok: true, state, events: [] };
      current.connected = false;
      current.disconnectedAt = now;
      events.push({ type: EVENT.PLAYER_DISCONNECTED, seat: player.seat, graceMs: draft.rules.disconnectGraceMs });
      break;
    }

    case ACTION.RECONNECT: {
      const current = playerBySeat(draft, player.seat);
      if (current.connected) return { ok: true, state, events: [] };
      current.connected = true;
      current.disconnectedAt = null;
      events.push({ type: EVENT.PLAYER_RECONNECTED, seat: player.seat });
      break;
    }

    case ACTION.FORFEIT_DISCONNECTED: {
      if (player.connected) return fail(state, "PLAYER_CONNECTED", "That player is connected.");
      if (now - player.disconnectedAt < state.rules.disconnectGraceMs) return fail(state, "NOT_EXPIRED", "The reconnect window is still open.");
      performLeave(draft, events, now, player.seat, "DISCONNECT");
      break;
    }

    default:
      return fail(state, "INVALID_ACTION", "That action isn't recognised.");
  }

  return commit(draft, events, action);
}

function commit(draft, events, action) {
  draft.version += 1;
  if (typeof action.actionId === "string") {
    draft.actionIds = [...draft.actionIds, action.actionId].slice(-RECENT_ACTION_IDS);
  }
  return { ok: true, state: draft, events };
}

// The seat whose action the engine is waiting for, or null when nobody is.
const seatToAct = (state) => (state.phase === PHASE.FINISHED ? null : state.turnSeat);

// Starting point for a rematch: same variant and players, the first move rotated
// to the next seat so nobody always goes first.
function createRematch(previous, { seed, now = 0 }) {
  const players = previous.players
    .filter((player) => player.status !== PLAYER_STATUS.LEFT)
    .map((player) => ({ userId: player.userId, name: player.name }));
  const remainingSeats = previous.order.filter((seat) => previous.players.find((p) => p.seat === seat && p.status !== PLAYER_STATUS.LEFT));
  const rotated = remainingSeats.length ? remainingSeats[(Math.max(0, remainingSeats.indexOf(previous.firstSeat)) + 1) % remainingSeats.length] : null;
  return createGame({ variantId: previous.variantId, players, seed, now, firstSeat: rotated });
}

module.exports = {
  ACTION,
  EVENT,
  PHASE,
  PLAYER_STATUS,
  FINISH_REASON,
  createGame,
  createRematch,
  applyAction,
  publicState,
  computeLegalMoves,
  playerBySeat,
  tokensHome,
  progressOf,
  seatToAct,
};
