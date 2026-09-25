const mongoose = require("mongoose");
const User = require("../models/User");
const Game = require("../models/Game");
const GameChallengeInvite = require("../models/GameChallengeInvite");
const GameChallengeMatch = require("../models/GameChallengeMatch");
const Friendship = require("../models/Friendship");
const { GameError } = require("./games/GameError");
const { getGameType } = require("./games/gameTypes");
const { OPTION_COUNT } = require("./games/questionBuilder");
const { shuffle } = require("./games/random");
const { ensureGamesSynced } = require("./game.service");
const { isReachable, listOnlineFriends } = require("./ticTacToe.service");
const { pairKey } = require("../utils/ids");
const { isBlockedEitherWay } = require("../utils/blocks");
const { safeUser } = require("../utils/serializers");

// Friend challenges: two friends play the SAME 10 questions of a Math or English
// game head-to-head. One module holds every rule and is used by both the REST
// routes and the Socket.IO handlers, so an invitation or an answer is validated
// by the same code however it arrives. The acting user always comes from the
// server (req.user / socket.userId) — never from the request body.
//
// The server owns the match completely: questions and the answer key, each
// player's private option order, the clock, scoring, the winner and the reward.
// Clients only ever receive their own view of it (see viewFor).

const INVITE_TTL_MS = 60 * 1000;
// After a question resolves both players see the result (their answers, the
// opponent's, the correct one) for this long, then everyone moves on together.
// (Overridable through the environment only so automated tests can hold it steady.)
const RESULT_HOLD_MS = Number(process.env.GAME_CHALLENGE_RESULT_HOLD_MS) || 2600;
// The next question's clock opens slightly after it is announced, so the entrance
// animation isn't taken out of the player's time.
const ACTIVATION_MS = 500;
// Network slack: an answer up to this long after the limit still counts normally.
const GRACE_MS = 1200;
// Multiplayer scoring — explicit and separate from every single-player rule.
const SCORING = { correct: 1, wrong: -1, timeout: -1 };

const userRoom = (userId) => `user:${userId}`;
const matchRoom = (matchId) => `game-challenge:${matchId}`;
const emit = (io, room, event, payload) => io?.to(room).emit(event, payload);
const isDuplicateKey = (error) => error?.code === 11000;
const notFound = () => new GameError(404, "NOT_FOUND", "Not found.");
const isInteger = (value) => typeof value === "number" && Number.isInteger(value);
const idStr = (value) => (value?._id ?? value).toString();

// ------------------------------------------------------------
// Serialization
// ------------------------------------------------------------

const publicUser = (user) => {
  if (!user) return null;
  const { id, fullName, avatar, initials } = safeUser(user);
  return { id, fullName, avatar, initials };
};

async function usersById(ids) {
  const unique = [...new Set(ids.map(String))];
  const users = await User.find({ _id: { $in: unique } }).select("fullName avatar");
  return new Map(users.map((user) => [user._id.toString(), publicUser(user)]));
}

async function gameDisplay(gameType) {
  const game = await Game.findOne({ type: gameType }).select("name icon").lean();
  const definition = getGameType(gameType);
  return { gameName: game?.name || definition?.name || gameType, gameIcon: game?.icon || definition?.icon || "" };
}

const serializeInvite = (invite, users, display) => ({
  id: invite._id.toString(),
  kind: invite.kind,
  status: invite.status,
  gameType: invite.gameType,
  gameName: display.gameName,
  gameIcon: display.gameIcon,
  expiresAt: invite.expiresAt,
  createdAt: invite.createdAt,
  matchId: invite.matchId ? invite.matchId.toString() : null,
  previousMatchId: invite.previousMatchId ? invite.previousMatchId.toString() : null,
  from: users.get(invite.inviterId.toString()) || { id: invite.inviterId.toString() },
  to: users.get(invite.inviteeId.toString()) || { id: invite.inviteeId.toString() },
});

const answerOf = (player, index) => player.answers.find((answer) => answer.questionIndex === index);
const outcomeOf = (answer) => (!answer ? null : answer.timedOut ? "timeout" : answer.correct ? "correct" : "wrong");

// Score/counts from RESOLVED questions only, so a player's own live score never
// reveals whether their still-unresolved answer was right.
function tally(player, lastResolved) {
  const totals = { score: 0, correct: 0, wrong: 0, timeout: 0 };
  for (const answer of player.answers) {
    if (answer.questionIndex > lastResolved) continue;
    totals.score += answer.points;
    if (answer.timedOut) totals.timeout += 1;
    else if (answer.correct) totals.correct += 1;
    else totals.wrong += 1;
  }
  return totals;
}

// What ONE player is allowed to see of a match. The correct answer, and what the
// opponent chose, exist here only for questions that have already resolved; a
// question still being answered shows just its prompt and this player's own
// option order, and whether the opponent has answered (never what they picked).
function viewFor(match, userId, users, now = Date.now()) {
  const meIndex = match.players.findIndex((player) => player.userId.toString() === userId.toString());
  const me = match.players[meIndex];
  const opponent = match.players[1 - meIndex];
  const lastResolved = match.phase === "result" ? match.currentIndex : match.currentIndex - 1;
  const finished = match.status !== "active";

  const results = [];
  for (let index = 0; index <= lastResolved; index++) {
    const question = match.questions[index];
    const order = me.optionOrder[index];
    const mine = answerOf(me, index);
    const theirs = answerOf(opponent, index);
    const textOf = (answer) => (answer && answer.selectedIndex !== null && answer.selectedIndex !== undefined ? question.options[answer.selectedIndex] : null);
    results.push({
      index,
      number: index + 1,
      prompt: question.prompt,
      options: order.map((k) => question.options[k]),
      correctPosition: order.indexOf(question.correctIndex),
      correctText: question.options[question.correctIndex],
      you: { selectedPosition: mine?.selectedPosition ?? null, selectedText: textOf(mine), outcome: outcomeOf(mine), points: mine?.points ?? 0 },
      opponent: { selectedText: textOf(theirs), outcome: outcomeOf(theirs), points: theirs?.points ?? 0 },
    });
  }

  let current = null;
  if (match.status === "active" && match.phase === "question") {
    const question = match.questions[match.currentIndex];
    const order = me.optionOrder[match.currentIndex];
    const mine = answerOf(me, match.currentIndex);
    const elapsed = now - match.questionStartedAt.getTime();
    current = {
      index: match.currentIndex,
      number: match.currentIndex + 1,
      prompt: question.prompt,
      options: order.map((k) => question.options[k]),
      remainingMs: Math.max(0, Math.min(match.timeLimitMs, match.timeLimitMs - elapsed)),
      answered: Boolean(mine),
      selectedPosition: mine ? mine.selectedPosition : null,
      opponentAnswered: Boolean(answerOf(opponent, match.currentIndex)),
    };
  }

  const won = finished && match.status === "completed" && match.winnerId && match.winnerId.toString() === userId.toString();
  const lost = finished && match.status === "completed" && match.winnerId && !won;
  return {
    id: match._id.toString(),
    version: match.currentIndex * 2 + (match.phase === "result" ? 1 : 0) + (finished ? 1000 : 0),
    gameType: match.gameType,
    category: match.category,
    gameName: match.gameName,
    gameIcon: match.gameIcon,
    status: match.status,
    phase: match.phase,
    total: match.questions.length,
    timeLimitSec: match.timeLimitMs / 1000,
    currentIndex: match.currentIndex,
    resultHoldMs: RESULT_HOLD_MS,
    you: users.get(userId.toString()) || { id: userId.toString() },
    opponent: users.get(idStr(opponent.userId)) || { id: idStr(opponent.userId) },
    totals: { you: tally(me, lastResolved), opponent: tally(opponent, lastResolved) },
    current,
    results,
    outcome: match.status === "completed" ? (match.winnerId ? (won ? "won" : "lost") : "draw") : null,
    abandonedBy: match.abandonedBy ? match.abandonedBy.toString() : null,
    rewardPoints: won ? match.rewardPoints : 0,
    rewardWithheld: match.rewardWithheld || null,
    startedAt: match.startedAt,
    finishedAt: match.finishedAt || null,
  };
}

// Sends every player THEIR OWN view (option orders differ, so payloads do too).
async function emitState(io, match, event, extra = {}) {
  if (!io) return;
  const users = await usersById(match.playerIds);
  const now = Date.now();
  for (const playerId of match.playerIds) {
    emit(io, userRoom(playerId), event, { matchId: match._id.toString(), ...extra, match: viewFor(match, playerId, users, now) });
  }
}

async function matchView(match, userId) {
  const users = await usersById(match.playerIds);
  return viewFor(match, userId, users);
}

// ------------------------------------------------------------
// Who may challenge whom
// ------------------------------------------------------------

// Friendship, blocks (either direction), presence (server-side, from the same
// tracker Messages use — never a client claim) and the target's "Game Requests"
// setting. `checkSetting` / `requireOnline` are false when ANSWERING something
// already sent or asking for a rematch, where only friendship and blocks matter.
async function assertCanChallenge(inviterId, target, { checkSetting = true, requireOnline = false } = {}) {
  if (!(await Friendship.exists({ pairKey: pairKey(inviterId, target._id) }))) {
    throw new GameError(403, "NOT_FRIENDS", "You can only challenge your friends.");
  }
  if (await isBlockedEitherWay(inviterId, target._id)) {
    throw new GameError(403, "BLOCKED", "You can't play with this user.");
  }
  if (requireOnline && !isReachable(target._id)) {
    throw new GameError(409, "TARGET_OFFLINE", `${target.fullName} isn't online right now.`);
  }
  if (checkSetting && (target.settings?.gameRequests ?? "friends") === "off") {
    throw new GameError(403, "GAME_REQUESTS_OFF", `${target.fullName} isn't accepting game requests right now.`);
  }
}

// ------------------------------------------------------------
// The match clock (server-authoritative)
//
// A match moves through: question (both answering) -> result (shown for
// RESULT_HOLD_MS) -> next question ... -> completed. Every transition is a
// conditional atomic update, so however many timers, sockets and requests race,
// each transition happens once. Times on the match are LOGICAL (a question's
// deadline, when its result began), so catching up after a long absence lands
// on exactly the state the clock dictates — a returning player is resolved by
// server time, never handed a fresh timer.
// ------------------------------------------------------------

const ticks = new Map(); // matchId -> { timer, at }

// Best-effort wake-up for the next transition. The database is authoritative:
// every read, join and answer settles the match first, so a lost timer (server
// restart) only means the next access catches the match up.
//
// The EARLIEST pending wake-up is kept: a settle that ran against a slightly
// stale copy of the match may ask for a later time (e.g. the old question's
// deadline) and must never push back a sooner one (the end of a result hold).
// Whenever a tick fires it re-reads the match and schedules what is due next.
function scheduleTick(io, matchId, atMs) {
  const key = matchId.toString();
  const pending = ticks.get(key);
  if (pending && pending.at <= atMs && pending.at > Date.now() - 1000) return;
  if (pending) clearTimeout(pending.timer);
  const timer = setTimeout(() => {
    ticks.delete(key);
    settleMatch(io, key).catch((error) => console.error("game challenge tick failed:", error));
  }, Math.max(0, atMs - Date.now()) + 40);
  timer.unref?.();
  ticks.set(key, { timer, at: atMs });
}

const playerFilter = (userId, questionIndex) => ({
  players: { $elemMatch: { userId, answers: { $not: { $elemMatch: { questionIndex } } } } },
});

// Records one player's answer (or timeout) for the CURRENT question, atomically.
// Returns null if the question moved on or that player had already answered —
// which is exactly how double answers, races and late requests are refused.
function recordAnswer(matchId, userId, questionIndex, entry) {
  const counter = entry.timedOut ? "timeoutCount" : entry.correct ? "correctCount" : "wrongCount";
  return GameChallengeMatch.findOneAndUpdate(
    { _id: matchId, status: "active", phase: "question", currentIndex: questionIndex, ...playerFilter(userId, questionIndex) },
    {
      $push: { "players.$.answers": entry },
      $inc: { "players.$.score": entry.points, [`players.$.${counter}`]: 1 },
    },
    { returnDocument: "after" },
  );
}

// Both answered -> resolve the question (once). On the last question the same
// update completes the match and sets the winner and reward.
async function resolveQuestion(io, matchId, questionIndex, at) {
  const match = await GameChallengeMatch.findById(matchId);
  if (!match || match.status !== "active" || match.phase !== "question" || match.currentIndex !== questionIndex) return null;
  if (!match.players.every((player) => answerOf(player, questionIndex))) return null;

  const $set = { phase: "result", resultAt: at };
  const isLast = questionIndex + 1 >= match.questions.length;
  if (isLast) {
    const [first, second] = match.players;
    $set.status = "completed";
    $set.finishedAt = at;
    if (first.score === second.score) {
      $set.isDraw = true;
    } else {
      const winner = first.score > second.score ? first : second;
      const loser = winner === first ? second : first;
      $set.winnerId = winner.userId;
      // Only the winner's POSITIVE score counts (a win never costs points), and
      // a match the loser never played (every question timed out) pays nothing.
      if (loser.timeoutCount >= match.questions.length) $set.rewardWithheld = "opponent_inactive";
      else $set.rewardPoints = Math.max(0, winner.score);
    }
  }

  const updated = await GameChallengeMatch.findOneAndUpdate(
    { _id: match._id, status: "active", phase: "question", currentIndex: questionIndex },
    { $set },
    { returnDocument: "after" },
  );
  if (!updated) return null;

  await emitState(io, updated, isLast ? "gameChallenge:finished" : "gameChallenge:questionResult");
  if (!isLast) scheduleTick(io, updated._id, at.getTime() + RESULT_HOLD_MS);
  return updated;
}

async function advance(io, match) {
  const startedAt = new Date(match.resultAt.getTime() + RESULT_HOLD_MS + ACTIVATION_MS);
  const updated = await GameChallengeMatch.findOneAndUpdate(
    { _id: match._id, status: "active", phase: "result", currentIndex: match.currentIndex },
    { $set: { phase: "question", currentIndex: match.currentIndex + 1, questionStartedAt: startedAt, resultAt: null } },
    { returnDocument: "after" },
  );
  if (!updated) return null;
  await emitState(io, updated, "gameChallenge:question");
  scheduleTick(io, updated._id, startedAt.getTime() + updated.timeLimitMs + GRACE_MS);
  return updated;
}

// Brings a match up to date with the server clock: unanswered questions past
// their deadline become timeouts for whoever hasn't answered, finished results
// give way to the next question. Safe to call from anywhere, any number of times.
async function settleMatch(io, matchId, now = Date.now()) {
  for (let step = 0; step < 60; step++) {
    const match = await GameChallengeMatch.findById(matchId);
    if (!match || match.status !== "active") return match;

    if (match.phase === "question") {
      const deadline = match.questionStartedAt.getTime() + match.timeLimitMs + GRACE_MS;
      if (now < deadline) {
        scheduleTick(io, match._id, deadline);
        return match;
      }
      const at = new Date(deadline);
      for (const player of match.players) {
        if (answerOf(player, match.currentIndex)) continue;
        await recordAnswer(match._id, player.userId, match.currentIndex, {
          questionIndex: match.currentIndex,
          selectedPosition: null,
          selectedIndex: null,
          correct: false,
          timedOut: true,
          points: SCORING.timeout,
          answeredAt: at,
        });
      }
      await resolveQuestion(io, match._id, match.currentIndex, at);
    } else {
      const due = match.resultAt.getTime() + RESULT_HOLD_MS;
      if (now < due) {
        scheduleTick(io, match._id, due);
        return match;
      }
      await advance(io, match);
    }
  }
  return GameChallengeMatch.findById(matchId);
}

// ------------------------------------------------------------
// Creating a match
// ------------------------------------------------------------

// A permutation of 0..3 per question for each player: both see the same
// question, each in their own random option order, and the two orders are never
// identical for a question.
function optionOrders(questionCount) {
  const identity = Array.from({ length: OPTION_COUNT }, (_, i) => i);
  const forA = [];
  const forB = [];
  for (let i = 0; i < questionCount; i++) {
    const a = shuffle(identity);
    let b = shuffle(identity);
    while (b.join() === a.join()) b = shuffle(identity);
    forA.push(a);
    forB.push(b);
  }
  return [forA, forB];
}

async function createMatch(invite, { previous = null } = {}) {
  await ensureGamesSynced();
  const definition = getGameType(invite.gameType);
  const game = await Game.findOne({ type: invite.gameType });
  if (!definition?.supportsChallenge || !game || !game.active) {
    throw new GameError(409, "GAME_UNAVAILABLE", "This game isn't available for challenges right now.");
  }

  const count = game.questionCount;
  const generated = await definition.generateShared({ count, excludeIds: previous?.questionIds || [] });
  const [orderA, orderB] = optionOrders(count);
  const now = Date.now();
  const playerIds = [invite.inviterId, invite.inviteeId];

  try {
    return await GameChallengeMatch.create({
      gameType: invite.gameType,
      category: game.category,
      gameName: game.name,
      gameIcon: game.icon,
      pairKey: pairKey(playerIds[0], playerIds[1]),
      playerIds,
      players: [
        { userId: playerIds[0], optionOrder: orderA },
        { userId: playerIds[1], optionOrder: orderB },
      ],
      questions: generated.questions,
      questionIds: generated.questionIds || [],
      timeLimitMs: definition.timeLimitSec * 1000,
      questionStartedAt: new Date(now + ACTIVATION_MS),
      invitationId: invite._id,
      rematchOf: previous?._id || null,
    });
  } catch (error) {
    // Two accepts raced — the unique invitationId means only one match exists.
    if (!isDuplicateKey(error)) throw error;
    return GameChallengeMatch.findOne({ invitationId: invite._id });
  }
}

async function startMatchFromInvite(io, invite) {
  const previous = invite.previousMatchId ? await GameChallengeMatch.findById(invite.previousMatchId).select("questionIds") : null;
  const match = await createMatch(invite, { previous });
  await GameChallengeInvite.updateOne({ _id: invite._id }, { $set: { matchId: match._id } });
  scheduleTick(io, match._id, match.questionStartedAt.getTime() + match.timeLimitMs + GRACE_MS);
  return match;
}

// ------------------------------------------------------------
// Invitations and rematch requests (one lifecycle, two kinds)
// ------------------------------------------------------------

const EVENTS = {
  invite: {
    created: "gameChallenge:invite",
    accepted: "gameChallenge:accepted",
    declined: "gameChallenge:declined",
    cancelled: "gameChallenge:cancelled",
    expired: "gameChallenge:expired",
  },
  rematch: {
    created: "gameChallenge:rematch",
    accepted: "gameChallenge:rematchAccepted",
    declined: "gameChallenge:rematchDeclined",
    cancelled: "gameChallenge:rematchCancelled",
    expired: "gameChallenge:rematchExpired",
  },
};

// Best-effort push when a request lapses; the database stays authoritative
// (every read and accept re-checks `expiresAt`).
function scheduleExpiry(io, invite) {
  const delay = Math.max(0, invite.expiresAt.getTime() - Date.now()) + 250;
  const timer = setTimeout(async () => {
    try {
      const expired = await GameChallengeInvite.findOneAndUpdate(
        { _id: invite._id, status: "pending", expiresAt: { $lte: new Date() } },
        { $set: { status: "expired", respondedAt: new Date() } },
        { returnDocument: "after" },
      );
      if (!expired) return;
      const payload = { inviteId: expired._id.toString(), requestId: expired._id.toString(), kind: expired.kind };
      emit(io, userRoom(expired.inviterId), EVENTS[expired.kind].expired, payload);
      emit(io, userRoom(expired.inviteeId), EVENTS[expired.kind].expired, payload);
    } catch (error) {
      console.error("game challenge expiry failed:", error);
    }
  }, delay);
  timer.unref?.();
}

const expireStale = (filter) =>
  GameChallengeInvite.updateMany(
    { ...filter, status: "pending", expiresAt: { $lte: new Date() } },
    { $set: { status: "expired", respondedAt: new Date() } },
  );

// A player can be in only one live match at a time. Settling first means a match
// nobody has touched for a while is brought to its true state (possibly
// finished) before it can block anything.
async function findActiveMatch(io, userId) {
  const active = await GameChallengeMatch.find({ playerIds: userId, status: "active" }).select("_id").lean();
  for (const { _id } of active) await settleMatch(io, _id);
  return GameChallengeMatch.findOne({ playerIds: userId, status: "active" }).select("_id").lean();
}

async function assertNobodyBusy(io, inviter, target) {
  const mine = await findActiveMatch(io, inviter._id);
  if (mine) {
    throw new GameError(409, "GAME_IN_PROGRESS", "You're already in a match.", { matchId: mine._id.toString() });
  }
  if (await findActiveMatch(io, target._id)) {
    throw new GameError(409, "OPPONENT_BUSY", `${target.fullName} is in a match right now.`);
  }
}

async function createRequest(io, { kind, inviter, target, gameType, previousMatchId = null }) {
  const key = pairKey(inviter._id, target._id);
  await assertNobodyBusy(io, inviter, target);
  await expireStale({ pairKey: key, kind });

  let invite;
  try {
    invite = await GameChallengeInvite.create({
      kind,
      gameType,
      inviterId: inviter._id,
      inviteeId: target._id,
      pairKey: key,
      previousMatchId,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const existing = await GameChallengeInvite.findOne({ pairKey: key, kind, status: "pending" }).lean();
    throw new GameError(409, "ALREADY_PENDING", "There is already a pending challenge between you two.", {
      inviteId: existing?._id.toString(),
      direction: existing && existing.inviterId.toString() === inviter._id.toString() ? "outgoing" : "incoming",
    });
  }

  const [users, display] = await Promise.all([usersById([inviter._id, target._id]), gameDisplay(gameType)]);
  const view = serializeInvite(invite, users, display);
  emit(io, userRoom(target._id), EVENTS[kind].created, { invite: view });
  scheduleExpiry(io, invite);
  return view;
}

async function createInvite(user, targetId, gameType, io) {
  if (!mongoose.isValidObjectId(targetId)) throw new GameError(400, "INVALID_USER", "Choose a friend to challenge.");
  if (targetId.toString() === user._id.toString()) throw new GameError(400, "INVALID_USER", "You can't challenge yourself.");
  const definition = typeof gameType === "string" ? getGameType(gameType) : null;
  if (!definition?.supportsChallenge) throw new GameError(404, "GAME_NOT_FOUND", "That game can't be played with a friend.");

  await ensureGamesSynced();
  const game = await Game.findOne({ type: gameType }).select("active");
  if (!game?.active) throw new GameError(409, "GAME_UNAVAILABLE", "This game isn't available right now.");

  const target = await User.findById(targetId).select("fullName avatar settings");
  if (!target) throw new GameError(404, "NOT_FOUND", "User not found.");
  await assertCanChallenge(user._id, target, { requireOnline: true });

  return createRequest(io, { kind: "invite", inviter: user, target, gameType });
}

async function findForInvitee(userId, requestId, kind) {
  if (!mongoose.isValidObjectId(requestId)) throw notFound();
  const invite = await GameChallengeInvite.findOne({ _id: requestId, inviteeId: userId, kind });
  if (!invite) throw notFound();
  return invite;
}

async function acceptRequest(user, requestId, io, kind) {
  const invite = await findForInvitee(user._id, requestId, kind);
  const events = EVENTS[kind];

  const respond = async (match) => {
    const payload = { inviteId: invite._id.toString(), requestId: invite._id.toString(), kind, matchId: match._id.toString(), by: user._id.toString() };
    emit(io, userRoom(invite.inviterId), events.accepted, payload);
    emit(io, userRoom(invite.inviteeId), events.accepted, payload);
    await emitState(io, match, "gameChallenge:started");
    return { match: await matchView(match, user._id) };
  };

  // Idempotent: a second tab / a retried request just gets the same match back.
  if (invite.status === "accepted") {
    const match = invite.matchId ? await GameChallengeMatch.findById(invite.matchId) : await startMatchFromInvite(io, invite);
    if (match) return { match: await matchView(match, user._id) };
  }
  if (invite.status === "expired" || invite.expiresAt <= new Date()) {
    await expireStale({ _id: invite._id });
    throw new GameError(409, "INVITE_EXPIRED", "This challenge has expired.");
  }
  if (invite.status !== "pending") throw new GameError(409, "INVITE_CLOSED", "This challenge is no longer available.");

  // Things can change during the window: still friends, not blocked, nobody busy?
  const inviter = await User.findById(invite.inviterId).select("fullName avatar settings");
  try {
    if (!inviter) throw notFound();
    await assertCanChallenge(user._id, inviter, { checkSetting: false });
    await assertNobodyBusy(io, user, inviter);
  } catch (error) {
    // A racing accept of THIS invitation may already have created the match
    // (which makes both players look "busy"): that's the same accept, not a failure.
    const already = await GameChallengeMatch.findOne({ invitationId: invite._id });
    if (already) return { match: await matchView(already, user._id) };
    await GameChallengeInvite.updateOne({ _id: invite._id, status: "pending" }, { $set: { status: "cancelled", respondedAt: new Date() } });
    throw error;
  }

  // The claim: only one caller can move pending -> accepted, and only inside the window.
  const claimed = await GameChallengeInvite.findOneAndUpdate(
    { _id: invite._id, inviteeId: user._id, status: "pending", expiresAt: { $gt: new Date() } },
    { $set: { status: "accepted", respondedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!claimed) {
    const latest = await GameChallengeInvite.findById(invite._id);
    if (latest?.status === "accepted") {
      const match = latest.matchId ? await GameChallengeMatch.findById(latest.matchId) : await startMatchFromInvite(io, latest);
      if (match) return { match: await matchView(match, user._id) };
    }
    throw new GameError(409, latest?.status === "expired" || latest?.expiresAt <= new Date() ? "INVITE_EXPIRED" : "INVITE_CLOSED", "This challenge is no longer available.");
  }

  return respond(await startMatchFromInvite(io, claimed));
}

async function declineRequest(user, requestId, io, kind) {
  const invite = await findForInvitee(user._id, requestId, kind);
  if (invite.status === "declined") return { declined: true };
  if (invite.status !== "pending") throw new GameError(409, "INVITE_CLOSED", "This challenge is no longer available.");

  const declined = await GameChallengeInvite.findOneAndUpdate(
    { _id: invite._id, inviteeId: user._id, status: "pending", expiresAt: { $gt: new Date() } },
    { $set: { status: "declined", respondedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!declined) {
    await expireStale({ _id: invite._id });
    throw new GameError(409, "INVITE_EXPIRED", "This challenge has expired.");
  }

  const payload = { inviteId: invite._id.toString(), requestId: invite._id.toString(), kind, by: user._id.toString() };
  emit(io, userRoom(invite.inviterId), EVENTS[kind].declined, payload);
  emit(io, userRoom(invite.inviteeId), EVENTS[kind].declined, payload);
  return { declined: true };
}

async function cancelRequest(user, requestId, io) {
  if (!mongoose.isValidObjectId(requestId)) throw notFound();
  const cancelled = await GameChallengeInvite.findOneAndUpdate(
    { _id: requestId, inviterId: user._id, status: "pending" },
    { $set: { status: "cancelled", respondedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!cancelled) {
    const existing = await GameChallengeInvite.findOne({ _id: requestId, inviterId: user._id }).select("_id").lean();
    if (!existing) throw notFound();
    throw new GameError(409, "INVITE_CLOSED", "This request is no longer pending.");
  }
  const payload = { inviteId: cancelled._id.toString(), requestId: cancelled._id.toString(), kind: cancelled.kind, by: user._id.toString() };
  emit(io, userRoom(cancelled.inviteeId), EVENTS[cancelled.kind].cancelled, payload);
  emit(io, userRoom(cancelled.inviterId), EVENTS[cancelled.kind].cancelled, payload);
  return { cancelled: true };
}

// Everything still waiting on an answer (shown after a reconnect or a fresh page load).
async function listPending(user) {
  await expireStale({ $or: [{ inviterId: user._id }, { inviteeId: user._id }] });
  const requests = await GameChallengeInvite.find({
    $or: [{ inviteeId: user._id }, { inviterId: user._id }],
    status: "pending",
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean();
  const users = await usersById(requests.flatMap((request) => [request.inviterId, request.inviteeId]));
  const displays = new Map();
  for (const type of new Set(requests.map((request) => request.gameType))) displays.set(type, await gameDisplay(type));
  const view = (request) => serializeInvite(request, users, displays.get(request.gameType));
  return {
    incoming: requests.filter((r) => r.inviteeId.toString() === user._id.toString()).map(view),
    outgoing: requests.filter((r) => r.inviterId.toString() === user._id.toString()).map(view),
  };
}

// ------------------------------------------------------------
// Playing
// ------------------------------------------------------------

async function findParticipantMatch(userId, matchId) {
  if (!mongoose.isValidObjectId(matchId)) throw notFound();
  const match = await GameChallengeMatch.findById(matchId).select("playerIds");
  // Someone else's match looks exactly like one that doesn't exist.
  if (!match || !match.playerIds.some((id) => id.toString() === userId.toString())) throw notFound();
  return match;
}

// The caller's view of a match, brought up to date with the server clock first.
async function getMatch(userId, matchId, io) {
  await findParticipantMatch(userId, matchId);
  const match = await settleMatch(io, matchId);
  return { match: await matchView(match, userId) };
}

async function listActive(userId, io) {
  const ids = await GameChallengeMatch.find({ playerIds: userId, status: "active" }).select("_id").lean();
  const views = [];
  for (const { _id } of ids) {
    const match = await settleMatch(io, _id);
    if (match?.status === "active") views.push(await matchView(match, userId));
  }
  return views;
}

// Joining the match's Socket.IO room (participants only) also re-syncs the player
// after a refresh or a dropped connection — the state comes from the database,
// and the clock is never restarted.
async function joinMatchRoom(userId, matchId, socket, io) {
  await findParticipantMatch(userId, matchId);
  await socket.join(matchRoom(matchId));
  const match = await settleMatch(io, matchId);
  socket.to(matchRoom(matchId)).emit("gameChallenge:joined", { matchId: matchId.toString(), userId: userId.toString() });
  return { match: { ...(await matchView(match, userId)), rematch: await rematchInfo(match, userId) } };
}

// One answer. The client says only WHICH question and WHICH position (in its own
// option order); correctness, timing, points, ordering, and everything that
// follows are decided here.
async function submitAnswer(userId, matchId, body, io, receivedAt = Date.now()) {
  await findParticipantMatch(userId, matchId);
  const { questionIndex, selectedPosition } = body || {};
  if (!isInteger(questionIndex) || !isInteger(selectedPosition) || selectedPosition < 0 || selectedPosition >= OPTION_COUNT) {
    throw new GameError(400, "VALIDATION_ERROR", "Choose an option.");
  }

  // Bring the match up to the server clock first: if this question's window
  // already closed, it is resolved as a timeout NOW and this request loses.
  const match = await settleMatch(io, matchId, receivedAt);
  if (match.status !== "active") throw new GameError(409, "GAME_NOT_ACTIVE", "This match has ended.");
  if (match.phase !== "question" || questionIndex !== match.currentIndex) {
    throw new GameError(409, "OUT_OF_SEQUENCE", "That question isn't currently active.");
  }
  const me = match.players.find((player) => player.userId.toString() === userId.toString());
  if (answerOf(me, questionIndex)) throw new GameError(409, "ALREADY_ANSWERED", "You've already answered this question.");

  const question = match.questions[questionIndex];
  const selectedIndex = me.optionOrder[questionIndex][selectedPosition];
  const correct = selectedIndex === question.correctIndex;
  const entry = {
    questionIndex,
    selectedPosition,
    selectedIndex,
    correct,
    timedOut: false,
    points: correct ? SCORING.correct : SCORING.wrong,
    answeredAt: new Date(receivedAt),
  };

  // Atomic and conditional on the question still being current and this player
  // not having answered it: two simultaneous requests (double tap, two tabs)
  // can only ever record one.
  const updated = await recordAnswer(match._id, userId, questionIndex, entry);
  if (!updated) {
    const latest = await GameChallengeMatch.findById(match._id);
    const already = latest && answerOf(latest.players.find((player) => player.userId.toString() === userId.toString()), questionIndex);
    throw new GameError(409, already ? "ALREADY_ANSWERED" : "OUT_OF_SEQUENCE", already ? "You've already answered this question." : "That question isn't currently active.");
  }

  // Tell the opponent (and only that — never what was chosen).
  const opponentId = updated.playerIds.find((id) => id.toString() !== userId.toString());
  emit(io, userRoom(opponentId), "gameChallenge:answer", { matchId: updated._id.toString(), questionIndex, userId: userId.toString() });

  await resolveQuestion(io, updated._id, questionIndex, new Date(receivedAt));
  const fresh = await GameChallengeMatch.findById(updated._id);
  return { match: await matchView(fresh, userId) };
}

// Leaving ends the match for both: no result, no points.
async function leaveMatch(userId, matchId, io) {
  await findParticipantMatch(userId, matchId);
  const left = await GameChallengeMatch.findOneAndUpdate(
    { _id: matchId, status: "active" },
    { $set: { status: "abandoned", abandonedBy: userId, finishedAt: new Date() } },
    { returnDocument: "after" },
  );
  clearTimeout(ticks.get(matchId.toString())?.timer);
  ticks.delete(matchId.toString());
  if (left) await emitState(io, left, "gameChallenge:player:left");
  const match = left || (await GameChallengeMatch.findById(matchId));
  return { match: await matchView(match, userId) };
}

// "Play again": asks the opponent; a match only starts if they accept.
async function requestRematch(user, matchId, io) {
  const match = await GameChallengeMatch.findById(mongoose.isValidObjectId(matchId) ? matchId : null);
  if (!match || !match.playerIds.some((id) => id.toString() === user._id.toString())) throw notFound();
  if (match.status !== "completed") throw new GameError(409, "GAME_NOT_FINISHED", "Finish the match before asking for a rematch.");

  const opponentId = match.playerIds.find((id) => id.toString() !== user._id.toString());
  const target = await User.findById(opponentId).select("fullName avatar settings");
  if (!target) throw notFound();
  await assertCanChallenge(user._id, target, { checkSetting: false });
  return createRequest(io, { kind: "rematch", inviter: user, target, gameType: match.gameType, previousMatchId: match._id });
}

// Where the requester's own rematch stands (so a refreshed result page is right).
async function rematchInfo(match, userId) {
  const invite = await GameChallengeInvite.findOne({ kind: "rematch", previousMatchId: match._id }).sort({ createdAt: -1 }).lean();
  if (!invite) return null;
  const mine = invite.inviterId.toString() === userId.toString();
  const status = invite.status === "pending" && invite.expiresAt <= new Date() ? "expired" : invite.status;
  return { requestId: invite._id.toString(), direction: mine ? "outgoing" : "incoming", status, expiresAt: invite.expiresAt, matchId: invite.matchId ? invite.matchId.toString() : null };
}

async function getMatchWithRematch(userId, matchId, io) {
  const { match } = await getMatch(userId, matchId, io);
  const doc = await GameChallengeMatch.findById(matchId).select("_id");
  return { match: { ...match, rematch: await rematchInfo(doc, userId) } };
}

module.exports = {
  INVITE_TTL_MS,
  RESULT_HOLD_MS,
  ACTIVATION_MS,
  GRACE_MS,
  SCORING,
  matchRoom,
  userRoom,
  listOnlineFriends,
  createInvite,
  acceptRequest,
  declineRequest,
  cancelRequest,
  listPending,
  getMatch: getMatchWithRematch,
  listActive,
  joinMatchRoom,
  submitAnswer,
  leaveMatch,
  requestRematch,
  settleMatch,
};
