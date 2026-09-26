const test = require("node:test");
const assert = require("node:assert/strict");

const engine = require("../../src/games/ludo/engine");
const { rollDie, nextFloat } = require("../../src/games/ludo/rng");
const { VARIANTS, VARIANT_IDS, rewardFor, listOnlineVariants } = require("../../src/games/ludo/variants");
const { resolveRules, DEFAULT_RULES } = require("../../src/games/ludo/rules");
const board = require("../../src/games/ludo/board");

const { ACTION, EVENT, PHASE, PLAYER_STATUS, FINISH_REASON, applyAction, computeLegalMoves } = engine;
const { FINISH, IN_BASE } = board;

const T0 = 1_000_000;
const NOW = T0 + 10_000; // after the start countdown
const clone = (value) => JSON.parse(JSON.stringify(value));

const players = (n) => Array.from({ length: n }, (_, i) => ({ userId: `user${i}`, name: `Player ${i}` }));
const make = (variantId = "CLASSIC_RANKED", n = 2, { seed = 7, rules } = {}) =>
  engine.createGame({ variantId, players: players(n), seed, now: T0, rules });

// --- state builders -----------------------------------------------------------------
const setTokens = (state, seat, positions) => {
  const next = clone(state);
  const player = next.players.find((p) => p.seat === seat);
  positions.forEach((pos, index) => {
    player.tokens[index].pos = pos;
  });
  return next;
};
// Puts the current player into the MOVE phase holding a given dice value.
const withRoll = (state, dice) => {
  const next = clone(state);
  next.dice = dice;
  next.phase = PHASE.MOVE;
  next.legal = computeLegalMoves(next, next.turnSeat, dice);
  return next;
};
// A state whose NEXT roll will be `value` (searches for a generator state that produces it).
const withNextDice = (state, value) => {
  for (let candidate = 1; candidate < 5000; candidate++) {
    if (rollDie(candidate).value === value) return { ...clone(state), rng: candidate };
  }
  throw new Error(`no seed gives ${value}`);
};
const act = (state, action, now = NOW) => applyAction(state, action, { now });
const ok = (result) => {
  assert.equal(result.ok, true, result.error ? `${result.error.code}: ${result.error.message}` : "");
  return result;
};
const types = (result) => result.events.map((event) => event.type);
const seatOf = (state, index) => state.players[index].seat;
const tokensOf = (state, seat) => state.players.find((p) => p.seat === seat).tokens.map((t) => t.pos);
const deepFreeze = (value) => {
  Object.values(value).forEach((child) => child && typeof child === "object" && deepFreeze(child));
  return Object.freeze(value);
};

// ==================================================================================
// Registry + rules
// ==================================================================================

test("variants: one central registry with all four modes and complete metadata", () => {
  assert.deepEqual(VARIANT_IDS, ["QUICK_CAPTURE", "CAPTURE_AND_HOME", "CLASSIC_RANKED", "LOCAL_CLASSIC"]);
  for (const id of VARIANT_IDS) {
    const v = VARIANTS[id];
    for (const key of ["id", "title", "description", "category", "maxPlayers", "minPlayers", "tokenCount", "winningRule", "online", "rankingEnabled", "leaderboardEnabled", "rules"]) {
      assert.notEqual(v[key], undefined, `${id}.${key}`);
    }
    assert.equal(v.id, id);
    assert.equal(v.tokenCount, 4);
  }
  assert.deepEqual(listOnlineVariants().map((v) => v.id), ["QUICK_CAPTURE", "CAPTURE_AND_HOME", "CLASSIC_RANKED"]);
  assert.equal(VARIANTS.LOCAL_CLASSIC.online, false);
  assert.equal(VARIANTS.LOCAL_CLASSIC.minPlayers, 4);
  assert.equal(VARIANTS.LOCAL_CLASSIC.maxPlayers, 4);
  assert.equal(VARIANTS.LOCAL_CLASSIC.leaderboardEnabled, false);
  assert.equal(VARIANTS.CLASSIC_RANKED.rankingEnabled, true);
  assert.equal(VARIANTS.QUICK_CAPTURE.rankingEnabled, false);
});

test("rules: defaults are configurable and validated", () => {
  const rules = resolveRules({ maxConsecutiveSixes: 2, exactHome: false });
  assert.equal(rules.maxConsecutiveSixes, 2);
  assert.equal(rules.exactHome, false);
  assert.equal(rules.extraTurnOnSix, DEFAULT_RULES.extraTurnOnSix);
  assert.throws(() => resolveRules({ maxConsecutiveSixes: -1 }), RangeError);
  assert.throws(() => resolveRules({ exactHome: "yes" }), TypeError);
  assert.throws(() => resolveRules({ releaseRolls: [9] }), RangeError);
  assert.throws(() => resolveRules({ safeCells: [99] }), RangeError);
  assert.ok(Object.isFrozen(rules));
});

test("rewards: come from the registry, by player count and rank; unknown/local modes give nothing", () => {
  assert.deepEqual(rewardFor(VARIANTS.CLASSIC_RANKED, 4, 1), { points: 10, xp: 50, coins: 0 });
  assert.equal(rewardFor(VARIANTS.CLASSIC_RANKED, 4, 4).points, 0);
  assert.equal(rewardFor(VARIANTS.QUICK_CAPTURE, 2, 1).points, 3);
  assert.equal(rewardFor(VARIANTS.QUICK_CAPTURE, 2, 2).points, 0);
  assert.deepEqual(rewardFor(VARIANTS.LOCAL_CLASSIC, 4, 1), { points: 0, xp: 0, coins: 0 });
  assert.deepEqual(rewardFor(null, 2, 1), { points: 0, xp: 0, coins: 0 });
  assert.deepEqual(rewardFor(VARIANTS.CLASSIC_RANKED, 2, 0), { points: 0, xp: 0, coins: 0 });
});

// ==================================================================================
// RNG + dice
// ==================================================================================

test("rng: deterministic for the same state, always 1-6, and roughly uniform", () => {
  assert.deepEqual(rollDie(42), rollDie(42));
  assert.notEqual(nextFloat(1).state, nextFloat(2).state);
  const counts = [0, 0, 0, 0, 0, 0, 0];
  let state = 99;
  for (let i = 0; i < 6000; i++) {
    const roll = rollDie(state);
    assert.ok(roll.value >= 1 && roll.value <= 6);
    counts[roll.value]++;
    state = roll.state;
  }
  for (let face = 1; face <= 6; face++) assert.ok(counts[face] > 800 && counts[face] < 1200, `face ${face}: ${counts[face]}`);
});

test("dice: the roll comes from the engine's own generator, never from the action", () => {
  const state = make();
  const forged = act(state, { type: ACTION.ROLL_DICE, seat: state.turnSeat, value: 6, dice: 6 });
  ok(forged);
  const rolled = forged.events.find((e) => e.type === EVENT.DICE_ROLLED).value;
  assert.equal(rolled, rollDie(state.rng).value);
});

test("dice: the same state and action always give the same result (deterministic)", () => {
  const state = make("CLASSIC_RANKED", 3, { seed: 12345 });
  const a = act(state, { type: ACTION.ROLL_DICE, seat: state.turnSeat });
  const b = act(state, { type: ACTION.ROLL_DICE, seat: state.turnSeat });
  assert.deepEqual(a, b);
});

// ==================================================================================
// Creating games
// ==================================================================================

test("createGame: seats, tokens, timing and validation", () => {
  const two = make("CLASSIC_RANKED", 2);
  assert.deepEqual(two.players.map((p) => p.seat), [0, 2]);
  assert.deepEqual(two.players.map((p) => p.color), ["red", "yellow"]);
  assert.deepEqual(make("CLASSIC_RANKED", 3).players.map((p) => p.seat), [0, 1, 2]);
  const four = make("CLASSIC_RANKED", 4);
  assert.deepEqual(four.players.map((p) => p.seat), [0, 1, 2, 3]);
  for (const player of four.players) {
    assert.equal(player.tokens.length, 4);
    assert.ok(player.tokens.every((t) => t.pos === IN_BASE));
    assert.equal(player.status, PLAYER_STATUS.ACTIVE);
  }
  assert.equal(four.version, 0);
  assert.equal(four.phase, PHASE.ROLL);
  assert.equal(four.turnSeat, 0);
  assert.equal(four.startsAt, T0 + four.rules.countdownMs);
  assert.equal(four.turnDeadline, four.startsAt + four.rules.turnTimeMs);

  assert.throws(() => engine.createGame({ variantId: "NOPE", players: players(2), seed: 1 }), /Unknown Ludo variant/);
  assert.throws(() => engine.createGame({ variantId: "CLASSIC_RANKED", players: players(1), seed: 1 }), RangeError);
  assert.throws(() => engine.createGame({ variantId: "CLASSIC_RANKED", players: players(5), seed: 1 }), RangeError);
  assert.throws(() => engine.createGame({ variantId: "LOCAL_CLASSIC", players: players(2), seed: 1 }), RangeError);
  assert.throws(() => engine.createGame({ variantId: "CLASSIC_RANKED", players: players(2), seed: 1.5 }), TypeError);
});

test("createGame: names are trimmed and bounded; first seat can be chosen", () => {
  const state = engine.createGame({
    variantId: "QUICK_CAPTURE",
    players: [{ userId: "a", name: "  " + "x".repeat(60) }, { userId: "b", name: "" }],
    seed: 1,
    firstSeat: 2,
  });
  assert.equal(state.players[0].name.length, 24);
  assert.equal(state.players[1].name, "Player 2");
  assert.equal(state.turnSeat, 2);
});

test("local mode: same engine, four players, no timer, no countdown, no server ids needed", () => {
  const state = engine.createGame({ variantId: "LOCAL_CLASSIC", players: ["Ann", "Bob", "Cy", "Di"].map((name) => ({ name })), seed: 5, now: 500 });
  assert.equal(state.players.length, 4);
  assert.ok(state.players.every((p) => p.userId === null));
  assert.equal(state.turnDeadline, null);
  assert.equal(state.startsAt, 500);
  const rolled = ok(applyAction(state, { type: ACTION.ROLL_DICE, seat: 0 }, { now: 500 }));
  assert.ok(types(rolled).includes(EVENT.DICE_ROLLED));
  // No deadline, so a timeout can never fire.
  assert.equal(applyAction(state, { type: ACTION.TIMEOUT, seat: 0 }, { now: 9e12 }).error.code, "NOT_EXPIRED");
});

// ==================================================================================
// Legal moves, release, movement
// ==================================================================================

test("token release: only the configured dice value brings a token out", () => {
  const state = make();
  for (const dice of [1, 2, 3, 4, 5]) assert.deepEqual(computeLegalMoves(state, state.turnSeat, dice), []);
  const six = computeLegalMoves(state, state.turnSeat, 6);
  assert.equal(six.length, 4);
  assert.ok(six.every((m) => m.kind === "EXIT" && m.from === IN_BASE && m.to === 0 && m.path.join() === "0"));

  const custom = make("CLASSIC_RANKED", 2, { rules: { releaseRolls: [1, 6] } });
  assert.equal(computeLegalMoves(custom, custom.turnSeat, 1).length, 4);
  assert.equal(computeLegalMoves(custom, custom.turnSeat, 3).length, 0);
});

test("release: choosing a token brings it onto the colour's own start cell", () => {
  const state = withRoll(make(), 6);
  const result = ok(act(state, { type: ACTION.SELECT_TOKEN, seat: state.turnSeat, tokenId: 2 }));
  assert.deepEqual(tokensOf(result.state, state.turnSeat), [IN_BASE, IN_BASE, 0, IN_BASE]);
  const event = result.events.find((e) => e.type === EVENT.TOKEN_EXITED_HOME);
  assert.equal(event.tokenId, 2);
  assert.equal(event.to, 0);
});

test("movement: step-by-step path is reported and the token lands exactly dice steps ahead", () => {
  let state = setTokens(make(), 0, [10, IN_BASE, IN_BASE, IN_BASE]);
  state = withRoll(state, 4);
  const result = ok(act(state, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }));
  const moved = result.events.find((e) => e.type === EVENT.TOKEN_MOVED);
  assert.deepEqual(moved.path, [11, 12, 13, 14]);
  assert.equal(moved.from, 10);
  assert.equal(moved.to, 14);
  assert.equal(tokensOf(result.state, 0)[0], 14);
});

test("movement: a single legal move is made automatically (configurable)", () => {
  const state = setTokens(make(), 0, [10, IN_BASE, IN_BASE, IN_BASE]);
  const rolled = ok(act(withNextDice(state, 3), { type: ACTION.ROLL_DICE, seat: 0 }));
  assert.deepEqual(types(rolled).slice(0, 2), [EVENT.DICE_ROLLED, EVENT.TOKEN_MOVED]);
  assert.equal(tokensOf(rolled.state, 0)[0], 13);

  const manual = setTokens(make("CLASSIC_RANKED", 2, { rules: { autoMoveSingleLegal: false } }), 0, [10, IN_BASE, IN_BASE, IN_BASE]);
  const waiting = ok(act(withNextDice(manual, 3), { type: ACTION.ROLL_DICE, seat: 0 }));
  assert.equal(waiting.state.phase, PHASE.MOVE);
  assert.equal(waiting.state.legal.length, 1);
});

test("movement: several legal tokens wait for the player's choice", () => {
  const state = setTokens(make(), 0, [10, 20, IN_BASE, IN_BASE]);
  const rolled = ok(act(withNextDice(state, 2), { type: ACTION.ROLL_DICE, seat: 0 }));
  assert.equal(rolled.state.phase, PHASE.MOVE);
  assert.deepEqual(rolled.state.legal.map((m) => m.tokenId), [0, 1]);
  assert.equal(rolled.state.turnSeat, 0);
});

test("no legal move: the roll is reported and the turn passes automatically", () => {
  const state = make();
  const rolled = ok(act(withNextDice(state, 4), { type: ACTION.ROLL_DICE, seat: 0 }));
  assert.deepEqual(types(rolled), [EVENT.DICE_ROLLED, EVENT.NO_MOVES, EVENT.TURN_CHANGED]);
  assert.equal(rolled.state.turnSeat, 2);
  assert.equal(rolled.state.phase, PHASE.ROLL);
  assert.equal(rolled.state.turnNumber, 2);
});

test("token states: base, active (track or home column) and finished", () => {
  assert.equal(board.tokenState(IN_BASE), "HOME_BASE");
  for (const pos of [0, 25, 50, 51, 55]) assert.equal(board.tokenState(pos), "ACTIVE");
  assert.equal(board.tokenState(FINISH), "FINISHED");
});

test("absolute cells: each colour starts 13 cells apart and the shared track wraps", () => {
  assert.deepEqual(board.START_CELL, [0, 13, 26, 39]);
  assert.equal(board.absoluteCell(0, 0), 0);
  assert.equal(board.absoluteCell(1, 0), 13);
  assert.equal(board.absoluteCell(3, 0), 39);
  assert.equal(board.absoluteCell(3, 20), (39 + 20) % 52);
  assert.equal(board.absoluteCell(1, 50), (13 + 50) % 52);
  assert.equal(board.absoluteCell(0, IN_BASE), null);
  assert.equal(board.absoluteCell(0, 51), null);
  assert.equal(board.absoluteCell(0, FINISH), null);
  assert.equal(board.TRACK_GRID.length, board.TRACK_LENGTH);
  assert.equal(new Set(board.TRACK_GRID.map((c) => `${c.row},${c.col}`)).size, board.TRACK_LENGTH);
});

// ==================================================================================
// Safe zones + capture
// ==================================================================================

test("capture: landing on an opponent's token on a normal cell sends it back to base", () => {
  // Red token on its own cell 5 (abs 5); yellow token at its relative 30 (abs 26+30=56%52=4). Red moves 5 -> 5? use direct setup:
  // red rel 3 (abs 3); yellow rel 29 => abs (26+29)%52 = 3.
  let state = setTokens(make(), 0, [1, IN_BASE, IN_BASE, IN_BASE]);
  state = setTokens(state, 2, [29, IN_BASE, IN_BASE, IN_BASE]);
  state = withRoll(state, 2); // red 1 -> 3, abs 3
  const result = ok(act(state, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }));
  const capture = result.events.find((e) => e.type === EVENT.TOKEN_CAPTURED);
  assert.ok(capture);
  assert.equal(capture.by, 0);
  assert.equal(capture.victimSeat, 2);
  assert.equal(capture.victimTokenId, 0);
  assert.equal(capture.victimFrom, 29);
  assert.equal(tokensOf(result.state, 2)[0], IN_BASE);
  assert.equal(result.state.players.find((p) => p.seat === 0).captures, 1);
  assert.equal(result.state.players.find((p) => p.seat === 2).capturedCount, 1);
  assert.equal(result.state.captures.length, 1);
});

test("safe zone: a token on a safe cell cannot be captured", () => {
  // Yellow token on abs 8 (a star cell): yellow rel (8 - 26 + 52) % 52 = 34. Red lands on abs 8 = rel 8.
  let state = setTokens(make("CLASSIC_RANKED"), 0, [6, IN_BASE, IN_BASE, IN_BASE]);
  state = setTokens(state, 2, [34, IN_BASE, IN_BASE, IN_BASE]);
  state = withRoll(state, 2);
  const result = ok(act(state, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }));
  assert.equal(types(result).includes(EVENT.TOKEN_CAPTURED), false);
  assert.equal(tokensOf(result.state, 2)[0], 34);
  assert.equal(tokensOf(result.state, 0)[0], 8);
});

test("safe zone: another colour's start cell is safe too", () => {
  // Yellow starts at abs 26 = red rel 26.
  let state = setTokens(make(), 0, [24, IN_BASE, IN_BASE, IN_BASE]);
  state = setTokens(state, 2, [0, IN_BASE, IN_BASE, IN_BASE]);
  state = withRoll(state, 2);
  const result = ok(act(state, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }));
  assert.equal(types(result).includes(EVENT.TOKEN_CAPTURED), false);
  assert.equal(tokensOf(result.state, 2)[0], 0);
});

test("safe zone: safe cells come from the configuration, not the code", () => {
  let state = setTokens(make("CLASSIC_RANKED", 2, { rules: { safeCellsProtect: false } }), 0, [6, IN_BASE, IN_BASE, IN_BASE]);
  state = setTokens(state, 2, [34, IN_BASE, IN_BASE, IN_BASE]);
  state = withRoll(state, 2);
  const result = ok(act(state, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }));
  assert.equal(types(result).includes(EVENT.TOKEN_CAPTURED), true);

  let custom = setTokens(make("CLASSIC_RANKED", 2, { rules: { safeCells: [3] } }), 0, [1, IN_BASE, IN_BASE, IN_BASE]);
  custom = setTokens(custom, 2, [29, IN_BASE, IN_BASE, IN_BASE]);
  custom = withRoll(custom, 2);
  assert.equal(types(ok(act(custom, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }))).includes(EVENT.TOKEN_CAPTURED), false);
});

test("capture: never captures your own tokens (they stack) and passing over tokens is fine", () => {
  let state = setTokens(make(), 0, [1, 3, 5, IN_BASE]);
  state = withRoll(state, 2);
  const result = ok(act(state, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }));
  assert.equal(types(result).includes(EVENT.TOKEN_CAPTURED), false);
  assert.deepEqual(tokensOf(result.state, 0).slice(0, 2), [3, 3]);
});

test("capture: every opponent token on the landing cell is captured; tokens in a home column are never", () => {
  let state = setTokens(make("CLASSIC_RANKED"), 0, [1, IN_BASE, IN_BASE, IN_BASE]);
  state = setTokens(state, 2, [29, 29, 52, IN_BASE]);
  state = withRoll(state, 2);
  const result = ok(act(state, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }));
  assert.equal(result.events.filter((e) => e.type === EVENT.TOKEN_CAPTURED).length, 2);
  assert.deepEqual(tokensOf(result.state, 2), [IN_BASE, IN_BASE, 52, IN_BASE]);
});

test("capture: a player who left is off the board and cannot be captured", () => {
  let state = setTokens(make("CLASSIC_RANKED", 3), 0, [1, IN_BASE, IN_BASE, IN_BASE]);
  state = setTokens(state, 2, [29, IN_BASE, IN_BASE, IN_BASE]);
  state = clone(state);
  state.players.find((p) => p.seat === 2).status = PLAYER_STATUS.LEFT;
  state = withRoll(state, 2);
  const result = ok(act(state, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }));
  assert.equal(types(result).includes(EVENT.TOKEN_CAPTURED), false);
});

test("capture: grants a bonus turn unless the rule is off", () => {
  const build = (rules) => {
    let state = setTokens(make("CLASSIC_RANKED", 2, { rules }), 0, [1, IN_BASE, IN_BASE, IN_BASE]);
    state = setTokens(state, 2, [29, IN_BASE, IN_BASE, IN_BASE]);
    return withRoll(state, 2);
  };
  const bonus = ok(act(build({}), { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }));
  assert.deepEqual(types(bonus).slice(-1), [EVENT.EXTRA_TURN]);
  assert.equal(bonus.state.turnSeat, 0);
  const none = ok(act(build({ extraTurnOnCapture: false }), { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }));
  assert.equal(none.state.turnSeat, 2);
});

// ==================================================================================
// Extra turns and sixes
// ==================================================================================

test("extra turn: a six gives another roll to the same player", () => {
  const state = setTokens(make(), 0, [10, 20, IN_BASE, IN_BASE]);
  const rolled = ok(act(withNextDice(state, 6), { type: ACTION.ROLL_DICE, seat: 0 }));
  const chosen = ok(act(rolled.state, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }));
  assert.ok(types(chosen).includes(EVENT.EXTRA_TURN));
  assert.equal(chosen.state.turnSeat, 0);
  assert.equal(chosen.state.phase, PHASE.ROLL);
  assert.equal(chosen.state.consecutiveSixes, 1);
});

test("extra turn: a non-six passes the turn; sixes can be switched off", () => {
  const state = setTokens(make(), 0, [10, 20, IN_BASE, IN_BASE]);
  const rolled = ok(act(withNextDice(state, 3), { type: ACTION.ROLL_DICE, seat: 0 }));
  const chosen = ok(act(rolled.state, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 1 }));
  assert.equal(chosen.state.turnSeat, 2);

  const off = setTokens(make("CLASSIC_RANKED", 2, { rules: { extraTurnOnSix: false } }), 0, [10, 20, IN_BASE, IN_BASE]);
  const r = ok(act(withNextDice(off, 6), { type: ACTION.ROLL_DICE, seat: 0 }));
  assert.equal(ok(act(r.state, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 })).state.turnSeat, 2);
});

test("extra turn: a six with no legal move still rolls again", () => {
  let state = setTokens(make(), 0, [FINISH, FINISH, FINISH, 54]); // 54 + 6 would overshoot
  state = withNextDice(state, 6);
  const rolled = ok(act(state, { type: ACTION.ROLL_DICE, seat: 0 }));
  assert.deepEqual(types(rolled), [EVENT.DICE_ROLLED, EVENT.NO_MOVES, EVENT.EXTRA_TURN]);
  assert.equal(rolled.state.turnSeat, 0);
});

test("multiple sixes: the Nth six in a row forfeits the roll (N is configurable)", () => {
  const roll = (state, value) => ok(act(withNextDice(state, value), { type: ACTION.ROLL_DICE, seat: state.turnSeat }));
  const choose = (state) => ok(act(state, { type: ACTION.SELECT_TOKEN, seat: state.turnSeat, tokenId: state.legal[0].tokenId }));

  let state = setTokens(make(), 0, [10, 20, IN_BASE, IN_BASE]);
  state = choose(roll(state, 6).state).state; // six #1 -> extra turn
  state = choose(roll(state, 6).state).state; // six #2 -> extra turn
  const third = roll(state, 6);
  assert.ok(types(third).includes(EVENT.SIXES_LIMIT));
  assert.equal(third.state.turnSeat, 2, "the third six passes the turn");
  assert.equal(third.state.consecutiveSixes, 0);

  // Configured to 2: the second six already forfeits.
  let strict = setTokens(make("CLASSIC_RANKED", 2, { rules: { maxConsecutiveSixes: 2 } }), 0, [10, 20, IN_BASE, IN_BASE]);
  strict = choose(roll(strict, 6).state).state;
  assert.ok(types(roll(strict, 6)).includes(EVENT.SIXES_LIMIT));

  // 0 = unlimited.
  let loose = setTokens(make("CLASSIC_RANKED", 2, { rules: { maxConsecutiveSixes: 0 } }), 0, [10, 20, IN_BASE, IN_BASE]);
  for (let i = 0; i < 4; i++) loose = choose(roll(loose, 6).state).state;
  assert.equal(loose.turnSeat, 0);

  // A non-six resets the streak.
  let reset = setTokens(make(), 0, [10, 20, IN_BASE, IN_BASE]);
  reset = choose(roll(reset, 6).state).state;
  assert.equal(reset.consecutiveSixes, 1);
});

// ==================================================================================
// Home entry
// ==================================================================================

test("home entry: tokens leave the shared track into their own column and finish exactly", () => {
  let state = setTokens(make(), 0, [48, 10, IN_BASE, IN_BASE]);
  state = withRoll(state, 4); // 48 -> 52: inside the home column
  let result = ok(act(state, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }));
  assert.equal(tokensOf(result.state, 0)[0], 52);
  assert.equal(board.absoluteCell(0, 52), null, "no shared cell in the home column");

  state = setTokens(make(), 0, [52, 10, IN_BASE, IN_BASE]);
  state = withRoll(state, 4); // 52 + 4 = 56 = Home
  result = ok(act(state, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }));
  assert.equal(tokensOf(result.state, 0)[0], FINISH);
  assert.ok(types(result).includes(EVENT.TOKEN_FINISHED));
  assert.ok(types(result).includes(EVENT.EXTRA_TURN), "reaching Home grants a bonus turn");
});

test("exact home: a token can never overshoot Home", () => {
  const state = setTokens(make(), 0, [54, IN_BASE, IN_BASE, IN_BASE]);
  assert.equal(computeLegalMoves(state, 0, 3).length, 0);
  assert.equal(computeLegalMoves(state, 0, 2)[0].to, FINISH);
  assert.equal(computeLegalMoves(state, 0, 1)[0].to, 55);
  // Finished tokens never move.
  assert.equal(computeLegalMoves(setTokens(make(), 0, [FINISH, FINISH, FINISH, FINISH]), 0, 6).length, 0);

  const relaxed = setTokens(make("CLASSIC_RANKED", 2, { rules: { exactHome: false } }), 0, [54, IN_BASE, IN_BASE, IN_BASE]);
  assert.equal(computeLegalMoves(relaxed, 0, 5)[0].to, FINISH, "with exactHome off an overshoot lands on Home");
});

test("home entry: a token cannot be sent past Home via an illegal SELECT_TOKEN", () => {
  const state = withRoll(setTokens(make(), 0, [54, 20, IN_BASE, IN_BASE]), 3);
  assert.equal(act(state, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }).error.code, "ILLEGAL_MOVE");
  ok(act(state, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 1 }));
});

// ==================================================================================
// Variants — winning conditions
// ==================================================================================

const captureSetup = (variantId, n = 2) => {
  let state = setTokens(make(variantId, n), 0, [1, IN_BASE, IN_BASE, IN_BASE]);
  state = setTokens(state, 2, [29, IN_BASE, IN_BASE, IN_BASE]);
  return withRoll(state, 2);
};

test("Quick Ludo: the first capture wins immediately and the match ends", () => {
  const result = ok(act(captureSetup("QUICK_CAPTURE"), { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }));
  assert.equal(result.state.phase, PHASE.FINISHED);
  assert.equal(result.state.winnerSeat, 0);
  assert.equal(result.state.finishReason, FINISH_REASON.WIN_CONDITION);
  assert.deepEqual(result.state.rankings.map((r) => [r.seat, r.rank, r.result]), [[0, 1, "WIN"], [2, 2, "LOSS"]]);
  assert.ok(types(result).includes(EVENT.GAME_FINISHED));
  assert.equal(result.state.turnDeadline, null);
  assert.equal(act(result.state, { type: ACTION.ROLL_DICE, seat: 2 }).error.code, "GAME_FINISHED");
});

test("Quick Ludo: with four players everybody but the capturer loses", () => {
  const result = ok(act(captureSetup("QUICK_CAPTURE", 4), { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }));
  assert.equal(result.state.winnerSeat, 0);
  assert.deepEqual(result.state.rankings.map((r) => r.result).sort(), ["LOSS", "LOSS", "LOSS", "WIN"]);
});

test("Quick Ludo: no capture, no win — a safe-cell landing or plain move keeps playing", () => {
  const state = withRoll(setTokens(make("QUICK_CAPTURE"), 0, [6, IN_BASE, IN_BASE, IN_BASE]), 2);
  const result = ok(act(state, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }));
  assert.equal(result.state.phase, PHASE.ROLL);
  assert.equal(result.state.winnerSeat, null);
});

test("Capture + Home: capturing alone does not win", () => {
  const result = ok(act(captureSetup("CAPTURE_AND_HOME"), { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }));
  assert.equal(result.state.phase, PHASE.ROLL);
  assert.equal(result.state.winnerSeat, null);
  assert.equal(result.state.players.find((p) => p.seat === 0).hasCaptured, true);
});

test("Capture + Home: reaching Home alone does not win", () => {
  const state = withRoll(setTokens(make("CAPTURE_AND_HOME"), 0, [52, 10, IN_BASE, IN_BASE]), 4);
  const result = ok(act(state, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }));
  assert.equal(result.state.phase, PHASE.ROLL);
  assert.equal(result.state.winnerSeat, null);
});

test("Capture + Home: capture first, then Home wins", () => {
  let state = ok(act(captureSetup("CAPTURE_AND_HOME"), { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 })).state;
  state = setTokens(state, 0, [52, 10, IN_BASE, IN_BASE]);
  state = withRoll(state, 4);
  const result = ok(act(state, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }));
  assert.equal(result.state.phase, PHASE.FINISHED);
  assert.equal(result.state.winnerSeat, 0);
  assert.equal(result.state.finishReason, FINISH_REASON.WIN_CONDITION);
});

test("Capture + Home: Home first, then a capture wins", () => {
  let state = setTokens(make("CAPTURE_AND_HOME"), 0, [FINISH, 1, IN_BASE, IN_BASE]);
  state = setTokens(state, 2, [29, IN_BASE, IN_BASE, IN_BASE]);
  state = withRoll(state, 2);
  const result = ok(act(state, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 1 }));
  assert.equal(result.state.phase, PHASE.FINISHED);
  assert.equal(result.state.winnerSeat, 0);
});

test("Capture + Home: being captured or capturing for someone else never wins for the wrong player", () => {
  let state = setTokens(make("CAPTURE_AND_HOME"), 2, [FINISH, IN_BASE, IN_BASE, IN_BASE]);
  state = setTokens(state, 0, [1, IN_BASE, IN_BASE, IN_BASE]);
  state = setTokens(state, 2, [FINISH, 29, IN_BASE, IN_BASE]);
  state = withRoll(state, 2); // red captures yellow's token; red has no home token
  const result = ok(act(state, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }));
  assert.equal(result.state.phase, PHASE.ROLL, "red captured but has not been Home");
});

// A ranked game where seats finish one after another.
function finishTokens(state, seat) {
  return setTokens(state, seat, [FINISH, FINISH, FINISH, 52]);
}
const finishSeat = (state, seat) => {
  let next = clone(state);
  next.turnSeat = seat;
  next.phase = PHASE.ROLL;
  next = finishTokens(next, seat);
  next = withRoll(next, 4); // 52 -> 56
  return ok(act(next, { type: ACTION.SELECT_TOKEN, seat, tokenId: 3 }));
};

test("Classic ranked: players are ranked 1st, 2nd, 3rd, 4th in finishing order", () => {
  let state = make("CLASSIC_RANKED", 4);
  const first = finishSeat(state, 2);
  assert.ok(types(first).includes(EVENT.PLAYER_FINISHED));
  assert.equal(first.events.find((e) => e.type === EVENT.PLAYER_FINISHED).rank, 1);
  assert.equal(first.state.phase, PHASE.ROLL, "the game goes on");
  const second = finishSeat(first.state, 0);
  assert.equal(second.events.find((e) => e.type === EVENT.PLAYER_FINISHED).rank, 2);
  const third = finishSeat(second.state, 3);
  assert.equal(third.state.phase, PHASE.FINISHED, "with one player left the ranking is complete");
  assert.equal(third.state.finishReason, FINISH_REASON.RANKING_COMPLETE);
  assert.deepEqual(third.state.rankings.map((r) => [r.rank, r.seat]), [[1, 2], [2, 0], [3, 3], [4, 1]]);
  assert.equal(third.state.winnerSeat, 2);
  state = third.state;
  assert.equal(state.players.find((p) => p.seat === 1).rank, 4);
});

test("Classic ranked: with two players the first to finish wins and the game is over", () => {
  const result = finishSeat(make("CLASSIC_RANKED", 2), 0);
  assert.equal(result.state.phase, PHASE.FINISHED);
  assert.deepEqual(result.state.rankings.map((r) => [r.rank, r.seat]), [[1, 0], [2, 2]]);
});

test("Classic ranked: a finished player is skipped in the turn order and gets no bonus roll", () => {
  const first = finishSeat(make("CLASSIC_RANKED", 3), 1);
  assert.equal(first.state.phase, PHASE.ROLL);
  assert.notEqual(first.state.turnSeat, 1);
  let state = first.state;
  const seen = new Set();
  for (let i = 0; i < 6; i++) {
    seen.add(state.turnSeat);
    const rolled = ok(act(withNextDice(state, 1), { type: ACTION.ROLL_DICE, seat: state.turnSeat }));
    state = rolled.state;
  }
  assert.equal(seen.has(1), false);
});

test("Classic ranked: leavers are ranked below everyone who stayed, ahead-of-progress first", () => {
  let state = make("CLASSIC_RANKED", 3);
  state = setTokens(state, 1, [20, 10, IN_BASE, IN_BASE]);
  state = setTokens(state, 2, [5, IN_BASE, IN_BASE, IN_BASE]);
  const leave1 = ok(act(state, { type: ACTION.LEAVE_GAME, seat: 1 }));
  assert.equal(leave1.state.phase, PHASE.ROLL);
  const leave2 = ok(act(leave1.state, { type: ACTION.LEAVE_GAME, seat: 2 }));
  assert.equal(leave2.state.phase, PHASE.FINISHED);
  assert.equal(leave2.state.finishReason, FINISH_REASON.FORFEIT);
  assert.deepEqual(leave2.state.rankings.map((r) => [r.rank, r.seat, r.result]), [[1, 0, "WIN"], [2, 1, "FORFEIT"], [3, 2, "FORFEIT"]]);
});

test("Classic ranked: if only one player remains eligible the ranking is completed by the configured rule", () => {
  let state = finishSeat(make("CLASSIC_RANKED", 3), 0).state; // seat 0 is 1st
  state = setTokens(state, 1, [40, 30, 20, IN_BASE]);
  state = setTokens(state, 2, [10, IN_BASE, IN_BASE, IN_BASE]);
  const result = ok(act(state, { type: ACTION.LEAVE_GAME, seat: 2 }));
  assert.equal(result.state.phase, PHASE.FINISHED);
  assert.deepEqual(result.state.rankings.map((r) => [r.rank, r.seat]), [[1, 0], [2, 1], [3, 2]]);
});

test("Local Ludo: classic ranking among four players on one device", () => {
  let state = engine.createGame({ variantId: "LOCAL_CLASSIC", players: ["A", "B", "C", "D"].map((name) => ({ name })), seed: 3, now: 0 });
  const finish = (seat) => {
    let next = clone(state);
    next.turnSeat = seat;
    next.phase = PHASE.ROLL;
    next = withRoll(finishTokens(next, seat), 4);
    return ok(applyAction(next, { type: ACTION.SELECT_TOKEN, seat, tokenId: 3 }, { now: 0 }));
  };
  state = finish(1).state;
  state = finish(3).state;
  const last = finish(0);
  assert.equal(last.state.phase, PHASE.FINISHED);
  assert.deepEqual(last.state.rankings.map((r) => r.seat), [1, 3, 0, 2]);
});

// ==================================================================================
// Turn validation, phases and errors
// ==================================================================================

test("validation: turn, phase, token, player and unknown actions", () => {
  const state = make();
  assert.equal(act(state, { type: ACTION.ROLL_DICE, seat: 2 }).error.code, "NOT_YOUR_TURN");
  assert.equal(act(state, { type: ACTION.ROLL_DICE, seat: 1 }).error.code, "INVALID_PLAYER");
  assert.equal(act(state, { type: ACTION.ROLL_DICE }).error.code, "INVALID_PLAYER");
  assert.equal(act(state, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }).error.code, "MUST_ROLL");
  assert.equal(act(state, { type: "CHEAT", seat: 0 }).error.code, "INVALID_ACTION");
  assert.equal(act(state, null).error.code, "INVALID_ACTION");
  assert.equal(act(state, "ROLL").error.code, "INVALID_ACTION");

  const waiting = withRoll(setTokens(make(), 0, [10, 20, IN_BASE, IN_BASE]), 2);
  assert.equal(act(waiting, { type: ACTION.ROLL_DICE, seat: 0 }).error.code, "ALREADY_ROLLED");
  assert.equal(act(waiting, { type: ACTION.SELECT_TOKEN, seat: 2, tokenId: 0 }).error.code, "NOT_YOUR_TURN");
  for (const tokenId of [-1, 4, 1.5, "1", null, undefined]) {
    assert.equal(act(waiting, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId }).error.code, "INVALID_TOKEN", String(tokenId));
  }
  assert.equal(act(waiting, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 3 }).error.code, "ILLEGAL_MOVE");
});

test("validation: nobody can act before the countdown ends", () => {
  const state = make();
  assert.equal(applyAction(state, { type: ACTION.ROLL_DICE, seat: 0 }, { now: T0 + 100 }).error.code, "NOT_STARTED");
  ok(applyAction(state, { type: ACTION.ROLL_DICE, seat: 0 }, { now: state.startsAt }));
});

test("validation: a failed action leaves the state untouched", () => {
  const state = deepFreeze(make());
  const before = JSON.stringify(state);
  const result = act(state, { type: ACTION.ROLL_DICE, seat: 2 });
  assert.equal(result.ok, false);
  assert.equal(result.state, state);
  assert.equal(JSON.stringify(state), before);
});

test("purity: a successful action never mutates the input state", () => {
  const state = deepFreeze(setTokens(make(), 0, [10, 20, IN_BASE, IN_BASE]));
  const result = ok(act(withNextDice(state, 3), { type: ACTION.ROLL_DICE, seat: 0 }));
  assert.notEqual(result.state, state);
});

test("finished game: nothing but rematch requests is accepted", () => {
  const finished = ok(act(captureSetup("QUICK_CAPTURE"), { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 })).state;
  for (const type of [ACTION.ROLL_DICE, ACTION.SELECT_TOKEN, ACTION.TIMEOUT, ACTION.LEAVE_GAME]) {
    assert.equal(act(finished, { type, seat: 0, tokenId: 0 }, NOW + 1e9).error.code, "GAME_FINISHED", type);
  }
});

// ==================================================================================
// Idempotency + versions
// ==================================================================================

test("versioning: every accepted action increments the version; stale versions are rejected", () => {
  const state = make();
  assert.equal(state.version, 0);
  const one = ok(act(state, { type: ACTION.ROLL_DICE, seat: 0, expectedVersion: 0 }));
  assert.equal(one.state.version, 1);
  const stale = act(one.state, { type: ACTION.ROLL_DICE, seat: one.state.turnSeat, expectedVersion: 0 });
  assert.equal(stale.error.code, "STALE_VERSION");
  assert.equal(stale.state, one.state);
  ok(act(one.state, { type: ACTION.ROLL_DICE, seat: one.state.turnSeat, expectedVersion: 1 }));
  assert.equal(act(one.state, { type: ACTION.ROLL_DICE, seat: one.state.turnSeat, expectedVersion: 99 }).error.code, "STALE_VERSION");
});

test("idempotency: a replayed action id (double click, duplicate packet, reconnect replay) applies once", () => {
  const state = setTokens(make(), 0, [10, 20, IN_BASE, IN_BASE]);
  const action = { type: ACTION.ROLL_DICE, seat: 0, actionId: "a-1" };
  const first = ok(act(state, action));
  const again = ok(act(first.state, action));
  assert.equal(again.duplicate, true);
  assert.equal(again.state, first.state);
  assert.deepEqual(again.events, []);
  assert.equal(again.state.version, first.state.version);
});

test("double roll / double select: the second attempt fails cleanly", () => {
  const rolled = ok(act(withNextDice(setTokens(make(), 0, [10, 20, IN_BASE, IN_BASE]), 3), { type: ACTION.ROLL_DICE, seat: 0 }));
  assert.equal(act(rolled.state, { type: ACTION.ROLL_DICE, seat: 0 }).error.code, "ALREADY_ROLLED");
  const moved = ok(act(rolled.state, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }));
  assert.equal(act(moved.state, { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 }).error.code, "NOT_YOUR_TURN");
});

test("simultaneous actions: two players acting on the same state — only the rightful one succeeds", () => {
  const state = make();
  const results = [act(state, { type: ACTION.ROLL_DICE, seat: 0 }), act(state, { type: ACTION.ROLL_DICE, seat: 2 })];
  assert.deepEqual(results.map((r) => r.ok), [true, false]);
});

test("action ids: only the most recent ones are remembered (bounded)", () => {
  let state = make("CLASSIC_RANKED", 2, { rules: { turnTimeMs: 0 } });
  for (let i = 0; i < 40; i++) state = ok(act(withNextDice(state, 1), { type: ACTION.ROLL_DICE, seat: state.turnSeat, actionId: `id-${i}` })).state;
  assert.equal(state.actionIds.length, 24);
  assert.equal(state.actionIds.at(-1), "id-39");
});

// ==================================================================================
// Timeout
// ==================================================================================

test("timeout: cannot be triggered early", () => {
  const state = make();
  assert.equal(act(state, { type: ACTION.TIMEOUT, seat: state.turnSeat }, state.turnDeadline - 1).error.code, "NOT_EXPIRED");
});

test("timeout: an idle player's turn is played automatically and deterministically (roll, then the first legal token)", () => {
  const state = setTokens(make(), 0, [10, 20, IN_BASE, IN_BASE]);
  const ready = withNextDice(state, 3);
  const a = ok(act(ready, { type: ACTION.TIMEOUT, seat: 0 }, ready.turnDeadline));
  const b = ok(act(ready, { type: ACTION.TIMEOUT, seat: 0 }, ready.turnDeadline));
  assert.deepEqual(a, b);
  assert.deepEqual(types(a).slice(0, 3), [EVENT.TIMEOUT, EVENT.DICE_ROLLED, EVENT.TOKEN_MOVED]);
  assert.equal(a.events.find((e) => e.type === EVENT.TOKEN_MOVED).tokenId, 0, "lowest token id first");
  assert.equal(tokensOf(a.state, 0)[0], 13);
  assert.equal(a.state.players.find((p) => p.seat === 0).timeouts, 1);
  assert.equal(a.state.turnSeat, 2);
});

test("timeout: after rolling but before choosing, the first legal token is chosen", () => {
  const rolled = ok(act(withNextDice(setTokens(make(), 0, [10, 20, IN_BASE, IN_BASE]), 2), { type: ACTION.ROLL_DICE, seat: 0 }));
  assert.equal(rolled.state.phase, PHASE.MOVE);
  const result = ok(act(rolled.state, { type: ACTION.TIMEOUT, seat: 0 }, rolled.state.turnDeadline));
  assert.equal(tokensOf(result.state, 0)[0], 12);
  assert.equal(result.state.turnSeat, 2);
});

test("timeout: no legal move skips the turn", () => {
  const ready = withNextDice(make(), 2);
  const result = ok(act(ready, { type: ACTION.TIMEOUT, seat: 0 }, ready.turnDeadline));
  assert.deepEqual(types(result), [EVENT.TIMEOUT, EVENT.DICE_ROLLED, EVENT.NO_MOVES, EVENT.TURN_CHANGED]);
  assert.equal(result.state.turnSeat, 2);
});

test("timeout: consecutive timeouts forfeit at the configured limit", () => {
  let state = make("CLASSIC_RANKED", 2, { rules: { maxTimeoutsBeforeForfeit: 2 } });
  const timeoutTurn = (s) => ok(act(withNextDice(s, 2), { type: ACTION.TIMEOUT, seat: s.turnSeat }, s.turnDeadline));
  state = timeoutTurn(state).state; // seat 0: 1
  state = timeoutTurn(state).state; // seat 2: 1
  const last = timeoutTurn(state); // seat 0: 2 -> forfeit
  assert.ok(types(last).includes(EVENT.PLAYER_LEFT));
  assert.equal(last.events.find((e) => e.type === EVENT.PLAYER_LEFT).reason, "AFK");
  assert.equal(last.state.phase, PHASE.FINISHED);
  assert.equal(last.state.winnerSeat, 2);
});

test("timeout: acting yourself resets the consecutive-timeout counter", () => {
  let state = make("CLASSIC_RANKED", 2, { rules: { maxTimeoutsBeforeForfeit: 2 } });
  state = ok(act(withNextDice(state, 2), { type: ACTION.TIMEOUT, seat: 0 }, state.turnDeadline)).state; // seat 0 timeout #1
  state = ok(act(withNextDice(state, 2), { type: ACTION.ROLL_DICE, seat: 2 })).state; // seat 2 plays normally
  assert.equal(state.players.find((p) => p.seat === 2).timeouts, 0);
  const again = ok(act(withNextDice(state, 2), { type: ACTION.ROLL_DICE, seat: 0 }));
  assert.equal(again.state.players.find((p) => p.seat === 0).timeouts, 0);
});

test("timeout: the deadline is re-armed for each new turn from the server clock", () => {
  const state = make();
  const rolled = ok(applyAction(withNextDice(state, 2), { type: ACTION.ROLL_DICE, seat: 0 }, { now: NOW }));
  assert.equal(rolled.state.turnStartedAt, NOW);
  assert.equal(rolled.state.turnDeadline, NOW + rolled.state.rules.turnTimeMs);
});

// ==================================================================================
// Disconnect / reconnect / leave
// ==================================================================================

test("disconnect: marks the player away without changing the turn or the clock", () => {
  const state = make("CLASSIC_RANKED", 3);
  const result = ok(act(state, { type: ACTION.DISCONNECT, seat: 2 }, NOW));
  const player = result.state.players.find((p) => p.seat === 2);
  assert.equal(player.connected, false);
  assert.equal(player.disconnectedAt, NOW);
  assert.equal(result.state.turnDeadline, state.turnDeadline, "the timer keeps running");
  assert.equal(result.state.turnSeat, state.turnSeat);
  assert.deepEqual(types(result), [EVENT.PLAYER_DISCONNECTED]);
  // Reporting it twice changes nothing.
  assert.equal(ok(act(result.state, { type: ACTION.DISCONNECT, seat: 2 }, NOW + 1)).state, result.state);
});

test("reconnect: the player is back, and the game restored from a snapshot continues correctly", () => {
  let state = make("CLASSIC_RANKED", 2);
  state = ok(act(state, { type: ACTION.DISCONNECT, seat: 2 }, NOW)).state;
  const restored = clone(state); // what a database round trip gives
  const back = ok(act(restored, { type: ACTION.RECONNECT, seat: 2 }, NOW + 5000));
  assert.equal(back.state.players.find((p) => p.seat === 2).connected, true);
  assert.equal(back.state.players.find((p) => p.seat === 2).disconnectedAt, null);
  assert.deepEqual(types(back), [EVENT.PLAYER_RECONNECTED]);
  const played = ok(act(back.state, { type: ACTION.ROLL_DICE, seat: back.state.turnSeat }, NOW + 6000));
  assert.ok(types(played).includes(EVENT.DICE_ROLLED));
  // Reconnecting when already connected is a no-op.
  assert.equal(ok(act(back.state, { type: ACTION.RECONNECT, seat: 2 }, NOW + 7000)).state, back.state);
});

test("reconnect: state restoration keeps the dice generator, so the next roll is the same as before", () => {
  const state = make("CLASSIC_RANKED", 2, { seed: 4242 });
  const direct = ok(act(state, { type: ACTION.ROLL_DICE, seat: 0 }));
  const viaSnapshot = ok(act(JSON.parse(JSON.stringify(state)), { type: ACTION.ROLL_DICE, seat: 0 }));
  assert.deepEqual(direct.events, viaSnapshot.events);
});

test("disconnect grace: no forfeit inside the window, auto-forfeit after it", () => {
  let state = make("CLASSIC_RANKED", 2);
  state = ok(act(state, { type: ACTION.DISCONNECT, seat: 2 }, NOW)).state;
  const grace = state.rules.disconnectGraceMs;
  assert.equal(act(state, { type: ACTION.FORFEIT_DISCONNECTED, seat: 2 }, NOW + grace - 1).error.code, "NOT_EXPIRED");
  const result = ok(act(state, { type: ACTION.FORFEIT_DISCONNECTED, seat: 2 }, NOW + grace));
  assert.equal(result.events.find((e) => e.type === EVENT.PLAYER_LEFT).reason, "DISCONNECT");
  assert.equal(result.state.phase, PHASE.FINISHED);
  assert.equal(result.state.winnerSeat, 0);
  assert.equal(result.state.finishReason, FINISH_REASON.FORFEIT);
  // A connected player can't be forfeited this way.
  assert.equal(act(make(), { type: ACTION.FORFEIT_DISCONNECTED, seat: 0 }, NOW + 1e9).error.code, "PLAYER_CONNECTED");
});

test("leaving: ends a two-player game with the other player winning by forfeit", () => {
  const result = ok(act(make("CLASSIC_RANKED", 2), { type: ACTION.LEAVE_GAME, seat: 0 }));
  assert.deepEqual(types(result).slice(0, 2), [EVENT.PLAYER_LEFT, EVENT.GAME_FINISHED]);
  assert.equal(result.state.winnerSeat, 2);
  assert.equal(result.state.finishReason, FINISH_REASON.FORFEIT);
  assert.equal(result.state.players.find((p) => p.seat === 0).status, PLAYER_STATUS.LEFT);
  assert.equal(result.state.rankings.find((r) => r.seat === 0).result, "FORFEIT");
});

test("leaving: with more players the game continues and the turn moves on if it was theirs", () => {
  const state = make("QUICK_CAPTURE", 3);
  const result = ok(act(state, { type: ACTION.LEAVE_GAME, seat: 0 }));
  assert.equal(result.state.phase, PHASE.ROLL);
  assert.equal(result.state.turnSeat, 1);
  assert.ok(types(result).includes(EVENT.TURN_CHANGED));
  // A player who left can't act, and leaving twice is harmless.
  assert.equal(act(result.state, { type: ACTION.ROLL_DICE, seat: 0 }).error.code, "PLAYER_LEFT");
  assert.equal(ok(act(result.state, { type: ACTION.LEAVE_GAME, seat: 0 })).state, result.state);
});

test("leaving: in Quick / Capture+Home the last player standing wins by forfeit", () => {
  for (const variantId of ["QUICK_CAPTURE", "CAPTURE_AND_HOME"]) {
    let state = make(variantId, 3);
    state = ok(act(state, { type: ACTION.LEAVE_GAME, seat: 0 })).state;
    const end = ok(act(state, { type: ACTION.LEAVE_GAME, seat: 1 }));
    assert.equal(end.state.winnerSeat, 2, variantId);
    assert.equal(end.state.finishReason, FINISH_REASON.FORFEIT);
  }
});

test("abandonment: everyone leaving is a draw, not a win", () => {
  let state = make("QUICK_CAPTURE", 2);
  state = clone(state);
  state.players[1].status = PLAYER_STATUS.LEFT;
  const result = ok(act(state, { type: ACTION.LEAVE_GAME, seat: 0 }));
  assert.equal(result.state.finishReason, FINISH_REASON.DRAW);
  assert.equal(result.state.winnerSeat, null);
  assert.ok(types(result).includes(EVENT.DRAW));
});

test("safety: a game can't run forever — the turn cap ends it as a draw", () => {
  let state = make("CLASSIC_RANKED", 2, { rules: { maxTurns: 3, turnTimeMs: 0 } });
  for (let i = 0; i < 5 && state.phase !== PHASE.FINISHED; i++) {
    state = ok(act(withNextDice(state, 1), { type: ACTION.ROLL_DICE, seat: state.turnSeat })).state;
  }
  assert.equal(state.phase, PHASE.FINISHED);
  assert.equal(state.finishReason, FINISH_REASON.DRAW);
});

// ==================================================================================
// Rematch + public state
// ==================================================================================

test("rematch: only after the game ends; recorded once per player; the first seat rotates", () => {
  const live = make("QUICK_CAPTURE");
  assert.equal(act(live, { type: ACTION.REQUEST_REMATCH, seat: 0 }).error.code, "GAME_NOT_FINISHED");

  const finished = ok(act(captureSetup("QUICK_CAPTURE"), { type: ACTION.SELECT_TOKEN, seat: 0, tokenId: 0 })).state;
  const requested = ok(act(finished, { type: ACTION.REQUEST_REMATCH, seat: 2 }));
  assert.deepEqual(requested.state.rematchRequests, [2]);
  assert.deepEqual(types(requested), [EVENT.REMATCH_REQUESTED]);
  assert.deepEqual(ok(act(requested.state, { type: ACTION.REQUEST_REMATCH, seat: 2 })).state.rematchRequests, [2]);
  assert.equal(act(finished, { type: ACTION.REQUEST_REMATCH, seat: 1 }).error.code, "INVALID_PLAYER");

  const next = engine.createRematch(finished, { seed: 99, now: T0 });
  assert.equal(next.variantId, finished.variantId);
  assert.equal(next.players.length, 2);
  assert.equal(next.version, 0);
  assert.notEqual(next.turnSeat, finished.firstSeat, "the other player starts the rematch");
  assert.ok(next.players.every((p) => p.tokens.every((t) => t.pos === IN_BASE)));
});

test("rematch: players who left are not carried into the next game", () => {
  let state = make("QUICK_CAPTURE", 3);
  state = ok(act(state, { type: ACTION.LEAVE_GAME, seat: 1 })).state;
  state = clone(state);
  state.phase = PHASE.FINISHED;
  const next = engine.createRematch(state, { seed: 5 });
  assert.equal(next.players.length, 2);
  assert.deepEqual(next.players.map((p) => p.userId), ["user0", "user2"]);
});

test("publicState: hides the dice generator and replay list so rolls can't be predicted", () => {
  const state = ok(act(make(), { type: ACTION.ROLL_DICE, seat: 0, actionId: "x" })).state;
  const visible = engine.publicState(state);
  assert.equal("rng" in visible, false);
  assert.equal("actionIds" in visible, false);
  assert.equal(visible.version, state.version);
  assert.deepEqual(visible.players.map((p) => p.tokens.length), [4, 4]);
  assert.ok(JSON.stringify(visible).length < 4000);
});

// ==================================================================================
// Random play: invariants across every variant
// ==================================================================================

function checkInvariants(state) {
  for (const player of state.players) {
    assert.equal(player.tokens.length, 4);
    for (const token of player.tokens) {
      assert.ok(Number.isInteger(token.pos) && token.pos >= IN_BASE && token.pos <= FINISH, `token ${token.pos}`);
    }
    if (player.status === PLAYER_STATUS.FINISHED && state.variantId === "CLASSIC_RANKED") {
      assert.ok(player.tokens.every((t) => t.pos === FINISH));
    }
  }
  if (state.phase !== PHASE.FINISHED) {
    assert.equal(state.players.find((p) => p.seat === state.turnSeat).status, PLAYER_STATUS.ACTIVE);
  } else {
    assert.ok(state.rankings.length === state.players.length);
    assert.equal(state.turnDeadline, null);
  }
  assert.equal(state.phase === PHASE.MOVE, state.legal.length > 0);
}

test("fuzz: random legal play in every variant and player count always ends in a valid state", () => {
  let games = 0;
  for (const variantId of VARIANT_IDS) {
    const { minPlayers, maxPlayers } = VARIANTS[variantId];
    for (let count = minPlayers; count <= maxPlayers; count++) {
      for (let seed = 1; seed <= 12; seed++) {
        let state = make(variantId, count, { seed: seed * 7919 + count, rules: { turnTimeMs: 0 } });
        let pick = seed;
        for (let step = 0; step < 20000 && state.phase !== PHASE.FINISHED; step++) {
          const seat = state.turnSeat;
          const action =
            state.phase === PHASE.ROLL
              ? { type: ACTION.ROLL_DICE, seat, expectedVersion: state.version }
              : { type: ACTION.SELECT_TOKEN, seat, tokenId: state.legal[(pick = (pick * 31 + 7) % 1009) % state.legal.length].tokenId, expectedVersion: state.version };
          const result = applyAction(state, action, { now: NOW });
          assert.equal(result.ok, true, `${variantId} ${count}p seed ${seed}: ${result.error?.code}`);
          state = result.state;
          checkInvariants(state);
        }
        assert.equal(state.phase, PHASE.FINISHED, `${variantId} ${count}p seed ${seed} did not finish`);
        assert.ok(state.rankings.some((r) => r.rank === 1));
        games++;
      }
    }
  }
  assert.ok(games >= 100);
});

test("fuzz: replaying the same actions from the same seed reproduces the exact game", () => {
  const play = () => {
    let state = make("CLASSIC_RANKED", 4, { seed: 2024, rules: { turnTimeMs: 0 } });
    for (let step = 0; step < 400 && state.phase !== PHASE.FINISHED; step++) {
      const seat = state.turnSeat;
      const action = state.phase === PHASE.ROLL ? { type: ACTION.ROLL_DICE, seat } : { type: ACTION.SELECT_TOKEN, seat, tokenId: state.legal[0].tokenId };
      state = ok(applyAction(state, action, { now: NOW })).state;
    }
    return state;
  };
  assert.deepEqual(play(), play());
});

test("fuzz: the same game reached through timeouts alone also terminates", () => {
  let state = make("CLASSIC_RANKED", 2, { rules: { maxTimeoutsBeforeForfeit: 0, turnTimeMs: 1000 } });
  let now = NOW;
  for (let step = 0; step < 30000 && state.phase !== PHASE.FINISHED; step++) {
    now = Math.max(now, state.turnDeadline) + 1;
    state = ok(applyAction(state, { type: ACTION.TIMEOUT, seat: state.turnSeat }, { now })).state;
  }
  assert.equal(state.phase, PHASE.FINISHED);
});
