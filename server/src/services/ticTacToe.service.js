const mongoose = require("mongoose");
const User = require("../models/User");
const Friendship = require("../models/Friendship");
const TicTacToeGame = require("../models/TicTacToeGame");
const TicTacToeInvite = require("../models/TicTacToeInvite");
const { GameError } = require("./games/GameError");
const { pairKey } = require("../utils/ids");
const { isBlockedEitherWay, blockedPairIds } = require("../utils/blocks");
const { isOnline } = require("../utils/presence");
const { REACTION_TYPES } = require("../utils/reactionTypes");
const { safeUser } = require("../utils/serializers");
const { evaluateBoard, otherSymbol, isValidCell } = require("./ticTacToe/logic");

// The whole Tic-Tac-Toe backend in one place, used by BOTH the REST routes and
// the Socket.IO handlers, so a move (or an invitation) is validated by exactly
// the same code no matter how it arrives. Every function takes the
// authenticated user's id from the server (req.user / socket.userId) — never
// from the request body — and `io` (optional) only to broadcast the result.

const WIN_REWARD_POINTS = 20;
const INVITE_TTL_MS = 60 * 1000;
const GAME_TYPE = "tic-tac-toe";

const userRoom = (userId) => `user:${userId}`;
const gameRoom = (gameId) => `tic-tac-toe:${gameId}`;
const emit = (io, room, event, payload) => io?.to(room).emit(event, payload);

// A friend whose socket dropped a moment ago (a page refresh, or the app
// swapping its main-shell socket for the Study one) still counts as online for
// this long, so the invite list, the "went offline" broadcast and the server's
// own check all agree. A reconnect cancels the pending timer.
const OFFLINE_GRACE_MS = 2500;
const offlineTimers = new Map();
const isReachable = (userId) => isOnline(userId) || offlineTimers.has(userId.toString());

const idOf = (value) => (value?._id ?? value).toString();
const isDuplicateKey = (error) => error?.code === 11000;
const invalidId = () => new GameError(404, "NOT_FOUND", "Not found.");

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

// Viewer-agnostic on purpose: the same payload is broadcast to a game room, so
// it carries player ids and each client works out "which one am I" itself
// (for display only — the server re-checks identity on every action).
function serializeGame(game, users) {
  return {
    id: game._id.toString(),
    gameType: game.gameType,
    status: game.status,
    board: game.board,
    currentTurn: game.currentTurn,
    winner: game.winner || null,
    winnerId: game.winnerId ? game.winnerId.toString() : null,
    winningLine: game.winningLine || [],
    moveCount: game.moveCount,
    rewardPoints: game.rewardPoints || 0,
    abandonedBy: game.abandonedBy ? game.abandonedBy.toString() : null,
    rematchOf: game.rematchOf ? game.rematchOf.toString() : null,
    playerX: users.get(game.playerX.toString()) || { id: game.playerX.toString() },
    playerO: users.get(game.playerO.toString()) || { id: game.playerO.toString() },
    startedAt: game.startedAt,
    finishedAt: game.finishedAt || null,
  };
}

async function gameView(game) {
  const users = await usersById([game.playerX, game.playerO]);
  return serializeGame(game, users);
}

const serializeInvite = (invite, users) => ({
  id: invite._id.toString(),
  kind: invite.kind,
  status: invite.status,
  expiresAt: invite.expiresAt,
  createdAt: invite.createdAt,
  gameId: invite.gameId ? invite.gameId.toString() : null,
  previousGameId: invite.previousGameId ? invite.previousGameId.toString() : null,
  from: users.get(invite.inviterId.toString()) || { id: invite.inviterId.toString() },
  to: users.get(invite.inviteeId.toString()) || { id: invite.inviteeId.toString() },
});

// ------------------------------------------------------------
// Who may play with whom
// ------------------------------------------------------------

// Friendship, blocks (either direction) and the target's "Game Requests"
// setting — checked on the server for every new invitation and rematch
// request. `checkSetting: false` is used when ACCEPTING something already
// sent, where only friendship and blocks matter.
async function assertCanPlay(inviterId, target, { checkSetting = true, requireOnline = false } = {}) {
  const key = pairKey(inviterId, target._id);
  if (!(await Friendship.exists({ pairKey: key }))) {
    throw new GameError(403, "NOT_FRIENDS", "You can only play Tic-Tac-Toe with your friends.");
  }
  if (await isBlockedEitherWay(inviterId, target._id)) {
    throw new GameError(403, "BLOCKED", "You can't play with this user.");
  }
  // Presence comes from the server's own connection tracker (utils/presence),
  // never from anything the client says.
  if (requireOnline && !isReachable(target._id)) {
    throw new GameError(409, "TARGET_OFFLINE", `${target.fullName} isn't online right now.`);
  }
  if (checkSetting && (target.settings?.gameRequests ?? "friends") === "off") {
    throw new GameError(403, "GAME_REQUESTS_OFF", `${target.fullName} isn't accepting game requests right now.`);
  }
}

// ------------------------------------------------------------
// Settings + statistics
// ------------------------------------------------------------

const getSettings = async (user) => ({ gameRequests: user.settings?.gameRequests ?? "friends" });

async function updateSettings(user, input) {
  const value = input?.gameRequests;
  if (value !== "friends" && value !== "off") {
    throw new GameError(400, "VALIDATION_ERROR", 'Game Requests must be "friends" or "off".');
  }
  await User.updateOne({ _id: user._id }, { $set: { "settings.gameRequests": value } });
  return { gameRequests: value };
}

// Derived from completed (won / drawn) games only — an abandoned game is not
// a result — so it can never disagree with the games themselves.
async function getStats(userId) {
  const me = new mongoose.Types.ObjectId(userId.toString());
  const groups = await TicTacToeGame.aggregate([
    { $match: { status: { $in: ["won", "draw"] }, $or: [{ playerX: me }, { playerO: me }] } },
    { $group: { _id: { status: "$status", mine: { $eq: ["$winnerId", me] } }, count: { $sum: 1 } } },
  ]);
  const count = (predicate) => groups.filter(({ _id }) => predicate(_id)).reduce((sum, group) => sum + group.count, 0);
  const wins = count((g) => g.status === "won" && g.mine);
  const losses = count((g) => g.status === "won" && !g.mine);
  const draws = count((g) => g.status === "draw");
  return { played: wins + losses + draws, wins, losses, draws, winPoints: wins * WIN_REWARD_POINTS };
}

// ------------------------------------------------------------
// Invitations and rematch requests (one lifecycle, two kinds)
// ------------------------------------------------------------

const EVENTS = {
  invite: {
    created: "ticTacToe:invite",
    accepted: "ticTacToe:invite:accepted",
    declined: "ticTacToe:invite:declined",
    cancelled: "ticTacToe:invite:cancelled",
    expired: "ticTacToe:invite:expired",
  },
  rematch: {
    created: "ticTacToe:rematch",
    accepted: "ticTacToe:rematch:accepted",
    declined: "ticTacToe:rematch:declined",
    cancelled: "ticTacToe:rematch:cancelled",
    expired: "ticTacToe:rematch:expired",
  },
};

// Best-effort push when a request lapses. The database is authoritative
// either way — every read and every accept re-checks `expiresAt` — so a
// server restart that loses this timer only means clients rely on their own
// countdown and the lazy check.
function scheduleExpiry(io, invite) {
  const delay = Math.max(0, invite.expiresAt.getTime() - Date.now()) + 250;
  const timer = setTimeout(async () => {
    try {
      const expired = await TicTacToeInvite.findOneAndUpdate(
        { _id: invite._id, status: "pending", expiresAt: { $lte: new Date() } },
        { $set: { status: "expired", respondedAt: new Date() } },
        { returnDocument: "after" },
      );
      if (!expired) return;
      const payload = { inviteId: expired._id.toString(), requestId: expired._id.toString(), kind: expired.kind };
      emit(io, userRoom(expired.inviterId), EVENTS[expired.kind].expired, payload);
      emit(io, userRoom(expired.inviteeId), EVENTS[expired.kind].expired, payload);
    } catch (error) {
      console.error("tic-tac-toe expiry failed:", error);
    }
  }, delay);
  timer.unref?.();
}

// Marks anything past its window as expired so the "one pending per pair"
// slot is free again and a stale request can never be accepted.
const expireStale = (filter) =>
  TicTacToeInvite.updateMany(
    { ...filter, status: "pending", expiresAt: { $lte: new Date() } },
    { $set: { status: "expired", respondedAt: new Date() } },
  );

async function findRunningGame(key) {
  return TicTacToeGame.findOne({ pairKey: key, status: "active" }).select("_id").lean();
}

async function createRequest(io, { kind, inviter, target, previousGameId = null }) {
  const key = pairKey(inviter._id, target._id);

  const running = await findRunningGame(key);
  if (running) {
    throw new GameError(409, "GAME_IN_PROGRESS", "You already have a game in progress with this friend.", {
      gameId: running._id.toString(),
    });
  }

  await expireStale({ pairKey: key, kind });

  let invite;
  try {
    invite = await TicTacToeInvite.create({
      kind,
      gameType: GAME_TYPE,
      inviterId: inviter._id,
      inviteeId: target._id,
      pairKey: key,
      previousGameId,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const existing = await TicTacToeInvite.findOne({ pairKey: key, gameType: GAME_TYPE, kind, status: "pending" }).lean();
    throw new GameError(409, "ALREADY_PENDING", "There is already a pending request between you two.", {
      inviteId: existing?._id.toString(),
      direction: existing && existing.inviterId.toString() === inviter._id.toString() ? "outgoing" : "incoming",
    });
  }

  const users = await usersById([inviter._id, target._id]);
  const view = serializeInvite(invite, users);
  emit(io, userRoom(target._id), EVENTS[kind].created, { invite: view });
  scheduleExpiry(io, invite);
  return view;
}

async function createInvite(user, targetId, io) {
  if (!mongoose.isValidObjectId(targetId)) throw new GameError(400, "INVALID_USER", "Choose a friend to play with.");
  if (targetId.toString() === user._id.toString()) throw new GameError(400, "INVALID_USER", "You can't invite yourself.");

  const target = await User.findById(targetId).select("fullName avatar settings");
  if (!target) throw new GameError(404, "NOT_FOUND", "User not found.");
  await assertCanPlay(user._id, target, { requireOnline: true });

  return createRequest(io, { kind: "invite", inviter: user, target });
}

// Looks a request up for its invitee, or 404s (never reveals other people's).
async function findForInvitee(userId, requestId, kind) {
  if (!mongoose.isValidObjectId(requestId)) throw invalidId();
  const invite = await TicTacToeInvite.findOne({ _id: requestId, inviteeId: userId, kind });
  if (!invite) throw invalidId();
  return invite;
}

async function createGameFor(invite, { playerX, playerO, rematchOf = null }) {
  let game;
  try {
    game = await TicTacToeGame.create({
      playerX,
      playerO,
      pairKey: pairKey(playerX, playerO),
      invitationId: invite._id,
      rematchOf,
    });
  } catch (error) {
    // Two accepts raced — the unique invitationId means only one game exists.
    if (!isDuplicateKey(error)) throw error;
    game = await TicTacToeGame.findOne({ invitationId: invite._id });
  }
  await TicTacToeInvite.updateOne({ _id: invite._id }, { $set: { gameId: game._id } });
  return game;
}

async function acceptRequest(user, requestId, io, kind) {
  const invite = await findForInvitee(user._id, requestId, kind);
  const events = EVENTS[kind];

  const respond = async (game) => {
    const payload = { inviteId: invite._id.toString(), requestId: invite._id.toString(), kind, gameId: game._id.toString(), by: user._id.toString() };
    emit(io, userRoom(invite.inviterId), events.accepted, payload);
    emit(io, userRoom(invite.inviteeId), events.accepted, payload);
    return { game: await gameView(game) };
  };

  // Idempotent: a second tab / a retried request just gets the same game back.
  if (invite.status === "accepted") {
    const game = invite.gameId ? await TicTacToeGame.findById(invite.gameId) : await createFromInvite(invite);
    if (game) return { game: await gameView(game) };
  }
  if (invite.status === "expired" || invite.expiresAt <= new Date()) {
    await expireStale({ _id: invite._id });
    throw new GameError(409, "INVITE_EXPIRED", "This invitation has expired.");
  }
  if (invite.status !== "pending") {
    throw new GameError(409, "INVITE_CLOSED", "This invitation is no longer available.");
  }

  // Still friends, still not blocked? (Things can change during the window.)
  const inviter = await User.findById(invite.inviterId).select("fullName avatar settings");
  try {
    if (!inviter) throw new GameError(404, "NOT_FOUND", "User not found.");
    await assertCanPlay(user._id, inviter, { checkSetting: false });
  } catch (error) {
    await TicTacToeInvite.updateOne({ _id: invite._id, status: "pending" }, { $set: { status: "cancelled", respondedAt: new Date() } });
    throw error;
  }

  // The claim: only one caller can move pending -> accepted, and only inside the window.
  const claimed = await TicTacToeInvite.findOneAndUpdate(
    { _id: invite._id, inviteeId: user._id, status: "pending", expiresAt: { $gt: new Date() } },
    { $set: { status: "accepted", respondedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!claimed) {
    const latest = await TicTacToeInvite.findById(invite._id);
    if (latest?.status === "accepted") {
      const game = latest.gameId ? await TicTacToeGame.findById(latest.gameId) : await createFromInvite(latest);
      if (game) return { game: await gameView(game) };
    }
    throw new GameError(409, latest?.status === "expired" || latest?.expiresAt <= new Date() ? "INVITE_EXPIRED" : "INVITE_CLOSED", "This invitation is no longer available.");
  }

  const game = await createFromInvite(claimed);
  return respond(game);
}

// Builds the game for an accepted request: an invitation makes the inviter X
// and the invitee O; a rematch swaps who is X (X always moves first), so the
// starter alternates deterministically.
async function createFromInvite(invite) {
  if (invite.kind === "rematch" && invite.previousGameId) {
    const previous = await TicTacToeGame.findById(invite.previousGameId).select("playerX playerO");
    if (previous) {
      return createGameFor(invite, { playerX: previous.playerO, playerO: previous.playerX, rematchOf: previous._id });
    }
  }
  return createGameFor(invite, { playerX: invite.inviterId, playerO: invite.inviteeId });
}

async function declineRequest(user, requestId, io, kind) {
  const invite = await findForInvitee(user._id, requestId, kind);
  if (invite.status === "declined") return { declined: true };
  if (invite.status !== "pending") throw new GameError(409, "INVITE_CLOSED", "This invitation is no longer available.");

  const declined = await TicTacToeInvite.findOneAndUpdate(
    { _id: invite._id, inviteeId: user._id, status: "pending", expiresAt: { $gt: new Date() } },
    { $set: { status: "declined", respondedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!declined) {
    await expireStale({ _id: invite._id });
    throw new GameError(409, "INVITE_EXPIRED", "This invitation has expired.");
  }

  const payload = { inviteId: invite._id.toString(), requestId: invite._id.toString(), kind, by: user._id.toString() };
  emit(io, userRoom(invite.inviterId), EVENTS[kind].declined, payload);
  emit(io, userRoom(invite.inviteeId), EVENTS[kind].declined, payload);
  return { declined: true };
}

// The sender withdrawing a request that hasn't been answered.
async function cancelRequest(user, requestId, io) {
  if (!mongoose.isValidObjectId(requestId)) throw invalidId();
  const cancelled = await TicTacToeInvite.findOneAndUpdate(
    { _id: requestId, inviterId: user._id, status: "pending" },
    { $set: { status: "cancelled", respondedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!cancelled) {
    const existing = await TicTacToeInvite.findOne({ _id: requestId, inviterId: user._id }).select("_id").lean();
    if (!existing) throw invalidId();
    throw new GameError(409, "INVITE_CLOSED", "This request is no longer pending.");
  }
  const payload = { inviteId: cancelled._id.toString(), requestId: cancelled._id.toString(), kind: cancelled.kind, by: user._id.toString() };
  emit(io, userRoom(cancelled.inviteeId), EVENTS[cancelled.kind].cancelled, payload);
  emit(io, userRoom(cancelled.inviterId), EVENTS[cancelled.kind].cancelled, payload);
  return { cancelled: true };
}

// Everything still waiting on an answer — used to show a popup that arrived
// while the socket was reconnecting, or before this page was opened.
async function listPending(user) {
  const now = new Date();
  await expireStale({ $or: [{ inviterId: user._id }, { inviteeId: user._id }] });
  const requests = await TicTacToeInvite.find({
    $or: [{ inviteeId: user._id }, { inviterId: user._id }],
    status: "pending",
    expiresAt: { $gt: now },
  })
    .sort({ createdAt: -1 })
    .lean();
  const users = await usersById(requests.flatMap((request) => [request.inviterId, request.inviteeId]));
  const view = (request) => serializeInvite(request, users);
  return {
    incoming: requests.filter((r) => r.inviteeId.toString() === user._id.toString()).map(view),
    outgoing: requests.filter((r) => r.inviterId.toString() === user._id.toString()).map(view),
  };
}

// ------------------------------------------------------------
// Games
// ------------------------------------------------------------

async function findParticipantGame(userId, gameId) {
  if (!mongoose.isValidObjectId(gameId)) throw invalidId();
  const game = await TicTacToeGame.findById(gameId);
  // Someone else's game looks exactly like a game that doesn't exist.
  if (!game || (idOf(game.playerX) !== userId.toString() && idOf(game.playerO) !== userId.toString())) throw invalidId();
  return game;
}

// The outcome of the latest "play again" request for a finished game, so a
// refresh (or a missed event) still shows the right prompt/result.
async function rematchInfo(game, userId) {
  if (game.status !== "won" && game.status !== "draw") return null;
  const request = await TicTacToeInvite.findOne({ kind: "rematch", previousGameId: game._id }).sort({ createdAt: -1 }).lean();
  if (!request) return null;
  const direction = request.inviterId.toString() === userId.toString() ? "outgoing" : "incoming";
  const base = { requestId: request._id.toString(), direction };
  if (request.status === "pending" && request.expiresAt > new Date()) return { ...base, status: "pending", expiresAt: request.expiresAt };
  if (request.status === "declined") return { ...base, status: "declined" };
  if (request.status === "accepted" && request.gameId) return { ...base, status: "accepted", gameId: request.gameId.toString() };
  return null;
}

// My games that are still being played, newest first — lets someone who
// navigated away resume (a plain refresh already keeps the same URL).
async function listActive(userId) {
  const games = await TicTacToeGame.find({
    status: "active",
    $or: [{ playerX: userId }, { playerO: userId }],
  })
    .sort({ updatedAt: -1 })
    .limit(20)
    .lean();
  const users = await usersById(games.flatMap((game) => [game.playerX, game.playerO]));
  return games.map((game) => serializeGame(game, users));
}

async function getGame(userId, gameId) {
  const game = await findParticipantGame(userId, gameId);
  return { ...(await gameView(game)), rematch: await rematchInfo(game, userId) };
}

// One move. The board is only ever changed by a conditional update that says
// "this exact game, still active, still this player's turn, this cell still
// empty, and no other move has landed since I read it" — so two simultaneous
// moves (two tabs, a double tap, a retried request) cannot both apply. The
// loser re-reads and gets an accurate error instead.
async function makeMove(userId, gameId, cellIndex, io) {
  if (!isValidCell(cellIndex)) throw new GameError(400, "INVALID_CELL", "Choose a cell from 0 to 8.");

  for (let attempt = 0; attempt < 3; attempt++) {
    const game = await findParticipantGame(userId, gameId);
    if (game.status !== "active") throw new GameError(409, "GAME_NOT_ACTIVE", "This game is over.");

    const symbol = idOf(game.playerX) === userId.toString() ? "X" : "O";
    if (game.currentTurn !== symbol) throw new GameError(409, "NOT_YOUR_TURN", "It's not your turn.");
    if (game.board[cellIndex] !== null) throw new GameError(409, "CELL_TAKEN", "That cell is already taken.");

    const nextBoard = [...game.board];
    nextBoard[cellIndex] = symbol;
    const outcome = evaluateBoard(nextBoard);

    const $set = { [`board.${cellIndex}`]: symbol };
    if (outcome.status === "won") {
      // The reward is written in this same atomic update — see the model note.
      const winnerId = symbol === "X" ? game.playerX : game.playerO;
      Object.assign($set, {
        status: "won",
        winner: symbol,
        winnerId,
        winningLine: outcome.line,
        rewardPoints: WIN_REWARD_POINTS,
        finishedAt: new Date(),
      });
    } else if (outcome.status === "draw") {
      Object.assign($set, { status: "draw", finishedAt: new Date() });
    } else {
      $set.currentTurn = otherSymbol(symbol);
    }

    const updated = await TicTacToeGame.findOneAndUpdate(
      { _id: game._id, status: "active", currentTurn: symbol, [`board.${cellIndex}`]: null, moveCount: game.moveCount },
      { $set, $inc: { moveCount: 1 } },
      { returnDocument: "after" },
    );
    if (!updated) continue; // someone else's move landed first — re-read and re-judge

    const view = await gameView(updated);
    emit(io, gameRoom(updated._id), "ticTacToe:move", { gameId: view.id, cellIndex, symbol, game: view });
    if (updated.status !== "active") emit(io, gameRoom(updated._id), "ticTacToe:finished", { gameId: view.id, game: view });
    return { game: view };
  }
  throw new GameError(409, "MOVE_CONFLICT", "The board changed — try again.");
}

// Leaving. During a live game this ends it as "abandoned" — the leaver gets
// nothing and NEITHER does the opponent (no reward for a walkover); after a
// game has finished it's a plain no-op.
async function leaveGame(userId, gameId, io) {
  const game = await findParticipantGame(userId, gameId);
  if (game.status !== "active") return { game: await gameView(game) };

  const abandoned = await TicTacToeGame.findOneAndUpdate(
    { _id: game._id, status: "active" },
    { $set: { status: "abandoned", abandonedBy: userId, finishedAt: new Date() } },
    { returnDocument: "after" },
  );
  const latest = abandoned || (await TicTacToeGame.findById(game._id));
  const view = await gameView(latest);
  if (abandoned) {
    emit(io, gameRoom(game._id), "ticTacToe:player:left", { gameId: view.id, userId: userId.toString(), game: view });
    emit(io, gameRoom(game._id), "ticTacToe:state", { gameId: view.id, game: view });
  }
  return { game: view };
}

async function requestRematch(user, gameId, io) {
  const game = await findParticipantGame(user._id, gameId);
  if (game.status === "abandoned") throw new GameError(409, "GAME_ABANDONED", "Your opponent left the game.");
  if (game.status !== "won" && game.status !== "draw") throw new GameError(409, "GAME_NOT_FINISHED", "Finish this game first.");

  const opponentId = idOf(game.playerX) === user._id.toString() ? idOf(game.playerO) : idOf(game.playerX);
  const target = await User.findById(opponentId).select("fullName avatar settings");
  if (!target) throw new GameError(404, "NOT_FOUND", "User not found.");
  await assertCanPlay(user._id, target);

  return createRequest(io, { kind: "rematch", inviter: user, target, previousGameId: game._id });
}

// Called when a socket joins a game's room — the ONLY way into the room, and
// only for the game's two players.
// ------------------------------------------------------------
// Online friends (who can be invited right now)
// ------------------------------------------------------------

async function friendIdsOf(userId) {
  const friendships = await Friendship.find({ userIds: userId }).select("userIds").lean();
  return friendships.map((friendship) => friendship.userIds.map(String).find((id) => id !== userId.toString())).filter(Boolean);
}

// Only friends who are online right now (per the existing presence tracker),
// not blocked either way. Offline friends are never returned, so this endpoint
// can't be used to read anyone's offline state.
async function listOnlineFriends(user) {
  const [friendIds, blocked] = await Promise.all([friendIdsOf(user._id), blockedPairIds(user._id)]);
  const onlineIds = friendIds.filter((id) => !blocked.has(id) && isReachable(id));
  if (!onlineIds.length) return [];
  const users = await User.find({ _id: { $in: onlineIds } }).select("fullName avatar");
  return users.map(publicUser).sort((a, b) => a.fullName.localeCompare(b.fullName));
}

// Tells a user's friends (only) that they came online / went offline, over the
// existing Socket.IO server, so an open invite list updates without polling.
// The "offline" side waits OFFLINE_GRACE_MS (see above).

async function announcePresence(io, userId, online) {
  const id = userId.toString();
  clearTimeout(offlineTimers.get(id));
  offlineTimers.delete(id);

  const send = async () => {
    const [friendIds, blocked, user] = await Promise.all([
      friendIdsOf(id),
      blockedPairIds(id),
      online ? User.findById(id).select("fullName avatar") : null,
    ]);
    const payload = online ? { userId: id, isOnline: true, user: publicUser(user) } : { userId: id, isOnline: false };
    friendIds.filter((friendId) => !blocked.has(friendId)).forEach((friendId) => emit(io, userRoom(friendId), "ticTacToe:presence", payload));
  };

  if (online) return send();
  offlineTimers.set(
    id,
    setTimeout(() => {
      offlineTimers.delete(id);
      if (!isOnline(id)) send().catch((error) => console.error("tic-tac-toe presence broadcast failed:", error));
    }, OFFLINE_GRACE_MS),
  );
}

// ------------------------------------------------------------
// Reactions (purely visual — they never touch the game document)
// ------------------------------------------------------------

const GAME_REACTIONS = ["poke", ...REACTION_TYPES.filter((type) => ["haha", "sad", "angry"].includes(type))];
const REACTION_COOLDOWN_MS = 350;
const lastReactionAt = new Map();

// Validates a reaction and returns the room + payload to relay. Reads the game
// only to check membership and that it's still active; writes nothing.
async function prepareReaction(userId, gameId, type) {
  if (typeof type !== "string" || !GAME_REACTIONS.includes(type)) {
    throw new GameError(400, "INVALID_REACTION", "That reaction isn't available.");
  }
  if (!mongoose.isValidObjectId(gameId)) throw invalidId();
  const game = await TicTacToeGame.findOne({ _id: gameId, $or: [{ playerX: userId }, { playerO: userId }] }).select("status");
  if (!game) throw invalidId();
  if (game.status !== "active") throw new GameError(409, "GAME_NOT_ACTIVE", "This game has ended.");

  const now = Date.now();
  const key = `${userId}:${game._id}`;
  if (now - (lastReactionAt.get(key) || 0) < REACTION_COOLDOWN_MS) {
    throw new GameError(429, "RATE_LIMITED", "Slow down a little.");
  }
  lastReactionAt.set(key, now);
  if (lastReactionAt.size > 500) lastReactionAt.delete(lastReactionAt.keys().next().value);

  return { room: gameRoom(game._id), payload: { gameId: game._id.toString(), from: userId.toString(), type, at: now } };
}

async function joinGameRoom(userId, gameId, socket, io) {
  const game = await findParticipantGame(userId, gameId);
  await socket.join(gameRoom(game._id));
  const view = { ...(await gameView(game)), rematch: await rematchInfo(game, userId) };
  socket.to(gameRoom(game._id)).emit("ticTacToe:joined", { gameId: view.id, userId: userId.toString() });
  socket.emit("ticTacToe:state", { gameId: view.id, game: view });
  return { game: view };
}

module.exports = {
  WIN_REWARD_POINTS,
  INVITE_TTL_MS,
  gameRoom,
  userRoom,
  getSettings,
  updateSettings,
  getStats,
  createInvite,
  acceptRequest,
  declineRequest,
  cancelRequest,
  listPending,
  getGame,
  listActive,
  makeMove,
  leaveGame,
  requestRematch,
  joinGameRoom,
  listOnlineFriends,
  announcePresence,
  prepareReaction,
  GAME_REACTIONS,
};
