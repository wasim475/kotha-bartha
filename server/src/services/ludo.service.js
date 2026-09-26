const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/User");
const Friendship = require("../models/Friendship");
const Notification = require("../models/Notification");
const LudoGame = require("../models/LudoGame");
const LudoInvite = require("../models/LudoInvite");
const { GameError } = require("./games/GameError");
const { createNotification } = require("./notification.service");
const { pairKey } = require("../utils/ids");
const { isBlockedEitherWay } = require("../utils/blocks");
const { safeUser } = require("../utils/serializers");
const { listOnlineFriends, isReachable } = require("./ticTacToe.service");
const engine = require("../games/ludo/engine");
const { getVariant, listVariants, rewardFor } = require("../games/ludo/variants");

// The whole online Ludo backend, used by BOTH the REST routes and the Socket.IO
// handlers, so an action is validated by exactly the same code however it
// arrives. Every function takes the authenticated user's id from the server
// (req.user / socket.userId) — never from the request body — and `io` only to
// broadcast the result. The rules themselves live in games/ludo/engine.js (a
// pure function); this file owns identity, persistence, concurrency, timers,
// invitations and rewards.
//
// Rooms:   user:{id}   personal (invitations, lobby updates)
//          ludo:{gameId}   the participants of one game (state, chat, reactions)

const INVITE_TTL_MS = 90 * 1000;
const REMATCH_TTL_MS = 60 * 1000;
const LOBBY_IDLE_MS = 20 * 60 * 1000;
const SWEEP_MS = 10 * 1000;
const MIN_MOVES_FOR_REWARD = 4;
const CHAT_MAX = 140;
const CHAT_COOLDOWN_MS = 900;
const REACTION_COOLDOWN_MS = 500;
const HISTORY_PAGE_SIZE = 20;
// A refresh (or a page change that re-joins at once) shouldn't flash the player as "away".
const DISCONNECT_DEBOUNCE_MS = 1500;

const LUDO_REACTIONS = Object.freeze(["haha", "goodmove", "nice", "great", "oops", "hi"]);

const userRoom = (userId) => `user:${userId}`;
const gameRoom = (gameId) => `ludo:${gameId}`;
const emit = (io, room, event, payload) => io?.to(room).emit(event, payload);
const idOf = (value) => (value?._id ?? value).toString();
const notFound = () => new GameError(404, "NOT_FOUND", "Not found.");
const isDuplicateKey = (error) => error?.code === 11000;

// ---- Feature flags ------------------------------------------------------------------------
// LUDO_ENABLED=false turns the whole game off; LUDO_DISABLED_VARIANTS="QUICK_CAPTURE,..."
// switches individual modes off without touching the frontend (the catalog is served from here).
const ludoEnabled = () => process.env.LUDO_ENABLED !== "false";
const disabledVariantIds = () => new Set((process.env.LUDO_DISABLED_VARIANTS || "").split(",").map((item) => item.trim()).filter(Boolean));
const variantEnabled = (variant) => Boolean(variant) && variant.enabled !== false && !disabledVariantIds().has(variant.id);

function assertEnabled() {
  if (!ludoEnabled()) throw new GameError(503, "LUDO_DISABLED", "Ludo is not available right now.");
}

function onlineVariant(variantId) {
  assertEnabled();
  const variant = getVariant(variantId);
  if (!variant || !variant.online || !variantEnabled(variant)) {
    throw new GameError(400, "INVALID_VARIANT", "Choose one of the online Ludo modes.");
  }
  return variant;
}

// ---- Structured logging ------------------------------------------------------------------------
const LOG_LEVELS = { debug: 10, info: 20, warn: 30 };
function logLudo(event, data = {}, level = "info") {
  const threshold = LOG_LEVELS[process.env.LUDO_LOG_LEVEL] || LOG_LEVELS.info;
  if (LOG_LEVELS[level] < threshold) return;
  console.log(JSON.stringify({ ts: new Date().toISOString(), scope: "ludo", event, ...data }));
}

// A player who keeps sending actions the engine refuses is worth noticing.
const invalidCounters = new Map();
function noteInvalidAction(userId, gameId, code) {
  const key = `${userId}:${gameId}`;
  const now = Date.now();
  const recent = (invalidCounters.get(key) || []).filter((at) => now - at < 60000);
  recent.push(now);
  invalidCounters.set(key, recent);
  if (invalidCounters.size > 1000) invalidCounters.delete(invalidCounters.keys().next().value);
  logLudo("invalid_action", { gameId: String(gameId), userId: String(userId), code }, "warn");
  if (recent.length === 5) logLudo("suspicious_repeated_invalid_actions", { gameId: String(gameId), userId: String(userId), count: recent.length }, "warn");
}

// ---- Users ----------------------------------------------------------------------------------------
const publicUser = (user) => {
  if (!user) return null;
  const { id, fullName, avatar, initials } = safeUser(user);
  return { id, fullName, avatar, initials };
};

const userCache = new Map(); // id -> { at, user }
const USER_CACHE_MS = 5 * 60 * 1000;
async function usersById(ids) {
  const wanted = [...new Set(ids.filter(Boolean).map(String))];
  const now = Date.now();
  const result = new Map();
  const missing = [];
  for (const id of wanted) {
    const cached = userCache.get(id);
    if (cached && now - cached.at < USER_CACHE_MS) result.set(id, cached.user);
    else missing.push(id);
  }
  if (missing.length) {
    const users = await User.find({ _id: { $in: missing } }).select("fullName avatar");
    for (const user of users) {
      const view = publicUser(user);
      userCache.set(user._id.toString(), { at: now, user: view });
      result.set(view.id, view);
    }
    if (userCache.size > 2000) userCache.delete(userCache.keys().next().value);
  }
  return result;
}

// ---- Serialization ------------------------------------------------------------------------------------
// Viewer-agnostic on purpose (the same payload is broadcast to the room); clients
// work out "which one am I" from `players[].user.id` for display only — the server
// re-checks identity on every action.
function serializeGame(doc, users) {
  const userOf = (id) => users.get(String(id)) || { id: String(id) };
  const view = {
    id: doc._id.toString(),
    variantId: doc.variantId,
    status: doc.status,
    hostId: doc.hostId.toString(),
    settings: { minPlayers: doc.settings.minPlayers, maxPlayers: doc.settings.maxPlayers, autoStart: doc.settings.autoStart },
    expectedPlayers: doc.expectedPlayers ?? null,
    rematchOf: doc.rematchOf ? doc.rematchOf.toString() : null,
    members: doc.members.map((member) => ({ user: userOf(member.userId), ready: member.ready, joinedAt: member.joinedAt, online: isReachable(member.userId) })),
    game: null,
    results: null,
    startedAt: doc.startedAt || null,
    finishedAt: doc.finishedAt || null,
    durationSec: doc.durationSec ?? null,
    finishReason: doc.finishReason || null,
    serverNow: Date.now(),
  };

  if (doc.state) {
    const state = engine.publicState(doc.state);
    state.players = state.players.map((player) => ({ ...player, user: userOf(player.userId) }));
    view.game = state;
  }
  if (doc.status === "finished") {
    view.results = doc.rankings.map((row) => ({
      user: userOf(row.userId),
      seat: row.seat,
      rank: row.rank,
      result: row.result,
      captures: row.captures,
      tokensHome: row.tokensHome,
      rewardPoints: row.rewardPoints,
      rewardXp: row.rewardXp,
      rewardCoins: row.rewardCoins,
    }));
  }
  return view;
}

async function gameView(doc) {
  const ids = [...doc.members.map((member) => member.userId), doc.hostId];
  const view = serializeGame(doc, await usersById(ids));
  // Lobby player cards: level, wins and win rate, from finished matches.
  if (doc.status === "lobby") view.cards = await playerCards(doc.members.map((member) => member.userId));
  return view;
}

const serializeInvite = (invite, users) => ({
  id: invite._id.toString(),
  kind: invite.kind,
  status: invite.status,
  gameId: invite.gameId.toString(),
  variantId: invite.variantId,
  expiresAt: invite.expiresAt,
  createdAt: invite.createdAt,
  from: users.get(invite.inviterId.toString()) || { id: invite.inviterId.toString() },
  to: users.get(invite.inviteeId.toString()) || { id: invite.inviteeId.toString() },
});

// ---- Catalog --------------------------------------------------------------------------------------------
function listCatalog() {
  return {
    enabled: ludoEnabled(),
    variants: listVariants()
      .filter(variantEnabled)
      .map((variant) => ({
        id: variant.id,
        title: variant.title,
        description: variant.description,
        category: variant.category,
        minPlayers: variant.minPlayers,
        maxPlayers: variant.maxPlayers,
        tokenCount: variant.tokenCount,
        winningRule: variant.winningRule,
        rulesSummary: variant.rulesSummary,
        online: variant.online,
        local: variant.local,
        rankingEnabled: variant.rankingEnabled,
        leaderboardEnabled: variant.leaderboardEnabled,
        timer: variant.timer,
        rewards: variant.rewards,
      })),
  };
}

// ---- Who may play with whom ----------------------------------------------------------------------------------
async function assertCanInvite(inviterId, target, { requireOnline = true, checkSetting = true } = {}) {
  if (!(await Friendship.exists({ pairKey: pairKey(inviterId, target._id) }))) {
    throw new GameError(403, "NOT_FRIENDS", "You can only play Ludo with your friends.");
  }
  if (await isBlockedEitherWay(inviterId, target._id)) throw new GameError(403, "BLOCKED", "You can't play with this user.");
  if (requireOnline && !isReachable(target._id)) throw new GameError(409, "TARGET_OFFLINE", `${target.fullName} isn't online right now.`);
  if (checkSetting && (target.settings?.gameRequests ?? "friends") === "off") {
    throw new GameError(403, "GAME_REQUESTS_OFF", `${target.fullName} isn't accepting game requests right now.`);
  }
}

// One lobby-or-live Ludo game per person at a time.
async function findBusyGame(userId) {
  return LudoGame.findOne({ status: { $in: ["lobby", "active"] }, "members.userId": userId }).select("_id status variantId").lean();
}
async function assertNotBusy(userId, message = "You are already in a Ludo game.") {
  const busy = await findBusyGame(userId);
  if (busy) throw new GameError(409, "ALREADY_IN_GAME", message, { gameId: busy._id.toString(), status: busy.status });
}

// ---- Seats / membership -------------------------------------------------------------------------------------------
const seatOfUser = (state, userId) => state?.players.find((player) => player.userId === String(userId))?.seat ?? null;
const isMember = (doc, userId) => doc.members.some((member) => member.userId.toString() === String(userId));

async function findMemberGame(userId, gameId, { allowFinished = true } = {}) {
  if (!mongoose.isValidObjectId(gameId)) throw notFound();
  const doc = await LudoGame.findById(gameId);
  // Someone else's game looks exactly like a game that doesn't exist.
  if (!doc || !isMember(doc, userId)) throw notFound();
  if (!allowFinished && doc.status === "finished") throw new GameError(409, "GAME_NOT_ACTIVE", "This game is over.");
  return doc;
}

// ---- Notifications (the existing notification system) ----------------------------------------------------------
const fakeReq = (io) => ({ app: { get: () => io } });

async function notifyInvite(io, invite, inviter, variant) {
  try {
    await createNotification(fakeReq(io), {
      recipientId: invite.inviteeId,
      actorId: invite.inviterId,
      type: "ludo_invite",
      entityType: "ludo_invite",
      entityId: invite._id,
      payload: {
        inviteId: invite._id.toString(),
        gameId: invite.gameId.toString(),
        variantId: variant.id,
        variantTitle: variant.title,
        kind: invite.kind,
        status: "pending",
        expiresAt: invite.expiresAt,
        message: `${inviter.fullName} invited you to play Ludo (${variant.title}).`,
      },
      uniqueEventId: `ludo_invite:${invite._id}`,
    });
  } catch (error) {
    console.error("ludo notification failed:", error);
  }
}

// Keeps the notification's own status in step with the invitation.
const settleNotification = (invite, status) =>
  Notification.updateOne({ uniqueEventId: `ludo_invite:${invite._id}` }, { $set: { "payload.status": status, readAt: new Date() } }).catch(() => {});

// ---- Lobby ------------------------------------------------------------------------------------------------------
async function emitLobby(io, doc) {
  const view = await gameView(doc);
  for (const member of doc.members) emit(io, userRoom(member.userId), "ludo:lobby", { gameId: view.id, game: view });
  emit(io, gameRoom(doc._id), "ludo:lobby", { gameId: view.id, game: view });
  return view;
}

function validateSettings(variant, input, { currentMembers = 1 } = {}) {
  const min = Number.isInteger(input?.minPlayers) ? input.minPlayers : variant.minPlayers;
  const max = Number.isInteger(input?.maxPlayers) ? input.maxPlayers : variant.maxPlayers;
  if (min < variant.minPlayers || max > variant.maxPlayers || min > max) {
    throw new GameError(400, "INVALID_SETTINGS", `${variant.title} is played by ${variant.minPlayers} to ${variant.maxPlayers} players.`);
  }
  if (max < currentMembers) throw new GameError(400, "INVALID_SETTINGS", "There are already more players than that.");
  return { minPlayers: min, maxPlayers: max, autoStart: input?.autoStart === true };
}

async function createLobby(user, input, io) {
  const variant = onlineVariant(input?.variantId);
  await assertNotBusy(user._id);
  const settings = validateSettings(variant, input);
  const doc = await LudoGame.create({
    variantId: variant.id,
    hostId: user._id,
    settings,
    members: [{ userId: user._id, ready: true }],
  });
  logLudo("game_created", { gameId: doc._id.toString(), variant: variant.id, hostId: user._id.toString(), min: settings.minPlayers, max: settings.maxPlayers, autoStart: settings.autoStart });
  return { game: await gameView(doc) };
}

async function updateLobbySettings(user, gameId, input, io) {
  const doc = await findMemberGame(user._id, gameId);
  if (doc.hostId.toString() !== user._id.toString()) throw new GameError(403, "NOT_HOST", "Only the host can change the settings.");
  if (doc.status !== "lobby") throw new GameError(409, "GAME_STARTED", "The game has already started.");
  // The host may also switch the mode while the lobby is still open (not for a rematch lobby,
  // which is for replaying the same mode).
  let variant = getVariant(doc.variantId);
  let base = { minPlayers: doc.settings.minPlayers, maxPlayers: doc.settings.maxPlayers, autoStart: doc.settings.autoStart };
  const changingMode = typeof input?.variantId === "string" && input.variantId !== doc.variantId;
  if (changingMode) {
    if (doc.rematchOf) throw new GameError(409, "REMATCH_LOBBY", "A rematch is played in the same mode.");
    variant = onlineVariant(input.variantId);
    // Keep the host's player range where the new mode allows it; otherwise use the mode's own.
    base = { ...base, minPlayers: Math.max(variant.minPlayers, Math.min(base.minPlayers, variant.maxPlayers)), maxPlayers: Math.min(variant.maxPlayers, Math.max(base.maxPlayers, variant.minPlayers)) };
  }
  const settings = validateSettings(variant, { ...base, ...input }, { currentMembers: doc.members.length });
  const updated = await LudoGame.findOneAndUpdate({ _id: doc._id, status: "lobby" }, { $set: { settings, variantId: variant.id } }, { returnDocument: "after" });
  if (!updated) throw new GameError(409, "GAME_STARTED", "The game has already started.");
  if (changingMode) await LudoInvite.updateMany({ gameId: doc._id, status: "pending" }, { $set: { variantId: variant.id } });
  const view = await emitLobby(io, updated);
  await maybeAutoStart(io, updated);
  return { game: view };
}

async function setReady(user, gameId, ready, io) {
  const doc = await findMemberGame(user._id, gameId);
  if (doc.status !== "lobby") throw new GameError(409, "GAME_STARTED", "The game has already started.");
  const updated = await LudoGame.findOneAndUpdate(
    { _id: doc._id, status: "lobby", "members.userId": user._id },
    { $set: { "members.$.ready": ready !== false } },
    { returnDocument: "after" },
  );
  if (!updated) throw new GameError(409, "GAME_STARTED", "The game has already started.");
  return { game: await emitLobby(io, updated) };
}

// ---- Invitations ----------------------------------------------------------------------------------------------------
const EVENTS = {
  invite: { created: "ludo:invite", accepted: "ludo:invite:accepted", declined: "ludo:invite:declined", cancelled: "ludo:invite:cancelled", expired: "ludo:invite:expired" },
  rematch: { created: "ludo:rematch", accepted: "ludo:rematch:accepted", declined: "ludo:rematch:declined", cancelled: "ludo:rematch:cancelled", expired: "ludo:rematch:expired" },
};

function scheduleInviteExpiry(io, invite) {
  const delay = Math.max(0, invite.expiresAt.getTime() - Date.now()) + 250;
  const timer = setTimeout(async () => {
    try {
      const expired = await LudoInvite.findOneAndUpdate(
        { _id: invite._id, status: "pending", expiresAt: { $lte: new Date() } },
        { $set: { status: "expired", respondedAt: new Date() } },
        { returnDocument: "after" },
      );
      if (!expired) return;
      settleNotification(expired, "expired");
      const payload = { inviteId: expired._id.toString(), requestId: expired._id.toString(), gameId: expired.gameId.toString(), kind: expired.kind };
      emit(io, userRoom(expired.inviterId), EVENTS[expired.kind].expired, payload);
      emit(io, userRoom(expired.inviteeId), EVENTS[expired.kind].expired, payload);
    } catch (error) {
      console.error("ludo invite expiry failed:", error);
    }
  }, delay);
  timer.unref?.();
}

const expireStale = (filter) =>
  LudoInvite.updateMany({ ...filter, status: "pending", expiresAt: { $lte: new Date() } }, { $set: { status: "expired", respondedAt: new Date() } });

async function createInviteRecord(io, { kind, doc, inviter, target, ttl }) {
  await expireStale({ gameId: doc._id, inviteeId: target._id });
  let invite;
  try {
    invite = await LudoInvite.create({
      kind,
      gameId: doc._id,
      variantId: doc.variantId,
      inviterId: inviter._id,
      inviteeId: target._id,
      expiresAt: new Date(Date.now() + ttl),
    });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    throw new GameError(409, "ALREADY_PENDING", `${target.fullName} already has an invitation to this game.`);
  }
  const users = await usersById([inviter._id, target._id]);
  const view = serializeInvite(invite, users);
  emit(io, userRoom(target._id), EVENTS[kind].created, { invite: view });
  scheduleInviteExpiry(io, invite);
  notifyInvite(io, invite, inviter, getVariant(doc.variantId));
  logLudo("invite_created", { inviteId: invite._id.toString(), gameId: doc._id.toString(), kind, from: inviter._id.toString(), to: target._id.toString() });
  return view;
}

async function createInvite(user, gameId, targetId, io) {
  if (!mongoose.isValidObjectId(targetId)) throw new GameError(400, "INVALID_USER", "Choose a friend to play with.");
  if (targetId.toString() === user._id.toString()) throw new GameError(400, "INVALID_USER", "You can't invite yourself.");
  const doc = await findMemberGame(user._id, gameId);
  if (doc.hostId.toString() !== user._id.toString()) throw new GameError(403, "NOT_HOST", "Only the host can invite players.");
  if (doc.status !== "lobby") throw new GameError(409, "GAME_STARTED", "The game has already started.");
  if (isMember(doc, targetId)) throw new GameError(409, "ALREADY_JOINED", "They are already in this lobby.");

  if (await LudoInvite.exists({ gameId: doc._id, inviteeId: targetId, status: "pending", expiresAt: { $gt: new Date() } })) {
    throw new GameError(409, "ALREADY_PENDING", "They already have an invitation to this game.");
  }
  const pending = await LudoInvite.countDocuments({ gameId: doc._id, status: "pending", expiresAt: { $gt: new Date() } });
  if (doc.members.length + pending >= doc.settings.maxPlayers) {
    throw new GameError(409, "LOBBY_FULL", "All the seats are taken or already have an invitation.");
  }

  const target = await User.findById(targetId).select("fullName avatar settings");
  if (!target) throw notFound();
  await assertCanInvite(user._id, target);
  const busy = await findBusyGame(target._id);
  if (busy) throw new GameError(409, "TARGET_BUSY", `${target.fullName} is already in a Ludo game.`);

  return createInviteRecord(io, { kind: "invite", doc, inviter: user, target, ttl: INVITE_TTL_MS });
}

async function findForInvitee(userId, inviteId) {
  if (!mongoose.isValidObjectId(inviteId)) throw notFound();
  const invite = await LudoInvite.findOne({ _id: inviteId, inviteeId: userId });
  if (!invite) throw notFound();
  return invite;
}

// Accepting joins the lobby. The claim (pending -> accepted) and the seat are each
// taken by a conditional update, so two accepts, a double tap or a full lobby can
// never leave the invitation and the roster disagreeing.
async function acceptInvite(user, inviteId, io) {
  const invite = await findForInvitee(user._id, inviteId);
  const kind = invite.kind;

  if (invite.status === "accepted") {
    const doc = await LudoGame.findById(invite.gameId);
    if (doc && isMember(doc, user._id)) return { game: await gameView(doc) };
    throw new GameError(409, "INVITE_CLOSED", "This invitation is no longer available.");
  }
  if (invite.status === "expired" || invite.expiresAt <= new Date()) {
    await expireStale({ _id: invite._id });
    throw new GameError(409, "INVITE_EXPIRED", "This invitation has expired.");
  }
  if (invite.status !== "pending") throw new GameError(409, "INVITE_CLOSED", "This invitation is no longer available.");

  await assertNotBusy(user._id, "Finish or leave your current Ludo game first.");

  const inviter = await User.findById(invite.inviterId).select("fullName avatar settings");
  try {
    if (!inviter) throw notFound();
    await assertCanInvite(user._id, inviter, { requireOnline: false, checkSetting: false });
  } catch (error) {
    await LudoInvite.updateOne({ _id: invite._id, status: "pending" }, { $set: { status: "cancelled", respondedAt: new Date() } });
    throw error;
  }

  const claimed = await LudoInvite.findOneAndUpdate(
    { _id: invite._id, inviteeId: user._id, status: "pending", expiresAt: { $gt: new Date() } },
    { $set: { status: "accepted", respondedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!claimed) throw new GameError(409, "INVITE_CLOSED", "This invitation is no longer available.");

  const doc = await LudoGame.findById(claimed.gameId).select("settings status");
  const joined = doc
    ? await LudoGame.findOneAndUpdate(
        {
          _id: claimed.gameId,
          status: "lobby",
          "members.userId": { $ne: user._id },
          $expr: { $lt: [{ $size: "$members" }, doc.settings.maxPlayers] },
        },
        { $push: { members: { userId: user._id, ready: true } } },
        { returnDocument: "after" },
      )
    : null;

  if (!joined) {
    await LudoInvite.updateOne({ _id: claimed._id }, { $set: { status: "cancelled" } });
    settleNotification(claimed, "cancelled");
    throw new GameError(409, "LOBBY_CLOSED", "That lobby is full or has already started.");
  }

  settleNotification(claimed, "accepted");
  const payload = { inviteId: claimed._id.toString(), requestId: claimed._id.toString(), kind, gameId: claimed.gameId.toString(), by: user._id.toString() };
  emit(io, userRoom(claimed.inviterId), EVENTS[kind].accepted, payload);
  emit(io, userRoom(claimed.inviteeId), EVENTS[kind].accepted, payload);
  logLudo("invite_accepted", { inviteId: claimed._id.toString(), gameId: claimed.gameId.toString(), userId: user._id.toString() });

  const view = await emitLobby(io, joined);
  const started = await maybeAutoStart(io, joined);
  return { game: started || view };
}

async function declineInvite(user, inviteId, io) {
  const invite = await findForInvitee(user._id, inviteId);
  if (invite.status === "declined") return { declined: true };
  if (invite.status !== "pending") throw new GameError(409, "INVITE_CLOSED", "This invitation is no longer available.");
  const declined = await LudoInvite.findOneAndUpdate(
    { _id: invite._id, inviteeId: user._id, status: "pending", expiresAt: { $gt: new Date() } },
    { $set: { status: "declined", respondedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!declined) {
    await expireStale({ _id: invite._id });
    throw new GameError(409, "INVITE_EXPIRED", "This invitation has expired.");
  }
  settleNotification(declined, "declined");
  const payload = { inviteId: invite._id.toString(), requestId: invite._id.toString(), kind: invite.kind, gameId: invite.gameId.toString(), by: user._id.toString() };
  emit(io, userRoom(invite.inviterId), EVENTS[invite.kind].declined, payload);
  emit(io, userRoom(invite.inviteeId), EVENTS[invite.kind].declined, payload);
  return { declined: true };
}

async function cancelInvite(user, inviteId, io) {
  if (!mongoose.isValidObjectId(inviteId)) throw notFound();
  const cancelled = await LudoInvite.findOneAndUpdate(
    { _id: inviteId, inviterId: user._id, status: "pending" },
    { $set: { status: "cancelled", respondedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!cancelled) {
    const existing = await LudoInvite.findOne({ _id: inviteId, inviterId: user._id }).select("_id").lean();
    if (!existing) throw notFound();
    throw new GameError(409, "INVITE_CLOSED", "This invitation is no longer pending.");
  }
  settleNotification(cancelled, "cancelled");
  const payload = { inviteId: cancelled._id.toString(), requestId: cancelled._id.toString(), kind: cancelled.kind, gameId: cancelled.gameId.toString(), by: user._id.toString() };
  emit(io, userRoom(cancelled.inviteeId), EVENTS[cancelled.kind].cancelled, payload);
  emit(io, userRoom(cancelled.inviterId), EVENTS[cancelled.kind].cancelled, payload);
  return { cancelled: true };
}

async function cancelPendingInvites(io, gameId) {
  const pending = await LudoInvite.find({ gameId, status: "pending" });
  if (!pending.length) return;
  await LudoInvite.updateMany({ gameId, status: "pending" }, { $set: { status: "cancelled", respondedAt: new Date() } });
  for (const invite of pending) {
    settleNotification(invite, "cancelled");
    const payload = { inviteId: invite._id.toString(), requestId: invite._id.toString(), kind: invite.kind, gameId: gameId.toString() };
    emit(io, userRoom(invite.inviteeId), EVENTS[invite.kind].cancelled, payload);
  }
}

async function listPendingInvites(user) {
  await expireStale({ $or: [{ inviterId: user._id }, { inviteeId: user._id }] });
  const invites = await LudoInvite.find({ $or: [{ inviteeId: user._id }, { inviterId: user._id }], status: "pending", expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .lean();
  const users = await usersById(invites.flatMap((invite) => [invite.inviterId, invite.inviteeId]));
  const view = (invite) => serializeInvite(invite, users);
  return {
    incoming: invites.filter((invite) => invite.inviteeId.toString() === user._id.toString()).map(view),
    outgoing: invites.filter((invite) => invite.inviterId.toString() === user._id.toString()).map(view),
  };
}

// ---- Starting ---------------------------------------------------------------------------------------------------------------
const newSeed = () => crypto.randomBytes(4).readUInt32BE(0) || 1;

function nextDeadlineOf(state) {
  if (state.phase === "FINISHED") return null;
  const times = [];
  if (state.turnDeadline !== null) times.push(state.turnDeadline);
  for (const player of state.players) {
    if (player.status === "ACTIVE" && !player.connected && player.disconnectedAt !== null) times.push(player.disconnectedAt + state.rules.disconnectGraceMs);
  }
  return times.length ? Math.min(...times) : null;
}

const mirrorFields = (state) => ({
  state,
  stateVersion: state.version,
  currentTurn: state.phase === "FINISHED" ? null : state.turnSeat,
  turnStartedAt: state.phase === "FINISHED" ? null : new Date(state.turnStartedAt),
  turnDeadline: state.turnDeadline === null ? null : new Date(state.turnDeadline),
  nextDeadlineAt: nextDeadlineOf(state) === null ? null : new Date(nextDeadlineOf(state)),
  moveCount: state.moveCount,
  captures: state.captures,
});

async function startGame(io, gameId, { byUserId = null } = {}) {
  const doc = await LudoGame.findById(gameId);
  if (!doc) throw notFound();
  if (doc.status !== "lobby") throw new GameError(409, "GAME_STARTED", "The game has already started.");
  if (byUserId !== null && doc.hostId.toString() !== String(byUserId)) throw new GameError(403, "NOT_HOST", "Only the host can start the game.");
  const variant = getVariant(doc.variantId);
  if (doc.members.length < doc.settings.minPlayers) {
    throw new GameError(409, "NOT_ENOUGH_PLAYERS", `At least ${doc.settings.minPlayers} players are needed.`);
  }
  if (byUserId !== null && !doc.settings.autoStart && doc.members.some((member) => !member.ready && member.userId.toString() !== doc.hostId.toString())) {
    throw new GameError(409, "PLAYERS_NOT_READY", "Everyone needs to be ready first.");
  }

  const users = await usersById(doc.members.map((member) => member.userId));
  // Host first; a rematch rotates who is seated (and so who moves) first.
  let ordered = doc.members.map((member) => member.userId.toString());
  if (doc.rematchOf) {
    const previous = await LudoGame.findById(doc.rematchOf).select("state").lean();
    const previousFirst = previous?.state?.players?.find((player) => player.seat === previous.state.firstSeat)?.userId;
    const index = ordered.indexOf(previousFirst);
    if (index >= 0) ordered = [...ordered.slice(index + 1), ...ordered.slice(0, index + 1)];
  }
  const now = Date.now();
  const state = engine.createGame({
    variantId: variant.id,
    players: ordered.map((id) => ({ userId: id, name: users.get(id)?.fullName || "Player" })),
    seed: newSeed(),
    now,
  });

  const started = await LudoGame.findOneAndUpdate(
    { _id: doc._id, status: "lobby", $expr: { $eq: [{ $size: "$members" }, doc.members.length] } },
    {
      $set: {
        status: "active",
        startedAt: new Date(now),
        participantIds: ordered.map((id) => new mongoose.Types.ObjectId(id)),
        "members.$[].ready": true,
        ...mirrorFields(state),
      },
    },
    { returnDocument: "after" },
  );
  if (!started) throw new GameError(409, "GAME_STARTED", "The lobby changed — try again.");

  await cancelPendingInvites(io, started._id);
  const view = await gameView(started);
  for (const member of started.members) emit(io, userRoom(member.userId), "ludo:started", { gameId: view.id, game: view });
  emit(io, gameRoom(started._id), "ludo:started", { gameId: view.id, game: view });
  armDeadline(io, started);
  logLudo("game_started", { gameId: view.id, variant: variant.id, players: ordered.length });
  return view;
}

async function maybeAutoStart(io, doc) {
  const shouldStart =
    (doc.settings.autoStart && doc.members.length >= doc.settings.minPlayers) ||
    (doc.expectedPlayers && doc.members.length >= doc.expectedPlayers);
  if (!shouldStart || doc.status !== "lobby") return null;
  try {
    return await startGame(io, doc._id);
  } catch (error) {
    if (error instanceof GameError) return null;
    throw error;
  }
}

async function startLobby(user, gameId, io) {
  const doc = await findMemberGame(user._id, gameId);
  return { game: await startGame(io, doc._id, { byUserId: user._id }) };
}

// ---- Leaving -------------------------------------------------------------------------------------------------------------------
async function leaveGame(user, gameId, io) {
  const doc = await findMemberGame(user._id, gameId);

  if (doc.status === "lobby") {
    if (doc.hostId.toString() === user._id.toString()) {
      const cancelled = await LudoGame.findOneAndUpdate({ _id: doc._id, status: "lobby" }, { $set: { status: "cancelled", finishedAt: new Date() } }, { returnDocument: "after" });
      if (cancelled) {
        await cancelPendingInvites(io, doc._id);
        for (const member of doc.members) emit(io, userRoom(member.userId), "ludo:lobby:closed", { gameId: doc._id.toString() });
      }
      return { game: await gameView(cancelled || doc) };
    }
    const updated = await LudoGame.findOneAndUpdate({ _id: doc._id, status: "lobby" }, { $pull: { members: { userId: user._id } } }, { returnDocument: "after" });
    if (updated) {
      emit(io, userRoom(user._id), "ludo:lobby:closed", { gameId: doc._id.toString() });
      await emitLobby(io, updated);
    }
    return { game: await gameView(updated || doc) };
  }

  if (doc.status !== "active") return { game: await gameView(doc) };
  return runAction({ io, gameId: doc._id, userId: user._id, action: { type: engine.ACTION.LEAVE_GAME } });
}

// ---- Reading a game ---------------------------------------------------------------------------------------------------------
async function rematchInfo(doc, userId) {
  if (doc.status !== "finished") return null;
  const lobby = await LudoGame.findOne({ rematchOf: doc._id, status: { $in: ["lobby", "active"] } }).sort({ createdAt: -1 }).select("_id status hostId").lean();
  if (!lobby) return null;
  const invite = await LudoInvite.findOne({ gameId: lobby._id, inviteeId: userId, kind: "rematch" }).sort({ createdAt: -1 }).select("_id status expiresAt").lean();
  return {
    gameId: lobby._id.toString(),
    status: lobby.status,
    hostId: lobby.hostId.toString(),
    invite: invite ? { id: invite._id.toString(), status: invite.status, expiresAt: invite.expiresAt } : null,
  };
}

async function getGame(userId, gameId) {
  const doc = await findMemberGame(userId, gameId);
  const view = await gameView(doc);
  return { ...view, mySeat: doc.state ? seatOfUser(doc.state, userId) : null, rematch: await rematchInfo(doc, userId) };
}

async function listActive(userId) {
  const docs = await LudoGame.find({ status: { $in: ["lobby", "active"] }, "members.userId": userId }).sort({ updatedAt: -1 }).limit(5);
  return Promise.all(docs.map((doc) => gameView(doc)));
}

const listOnlineFriendsFor = (user) => listOnlineFriends(user);

// ---- Actions (the heart of it) ----------------------------------------------------------------------------------------------
const timers = new Map(); // gameId -> Timeout

function armDeadline(io, doc) {
  const key = doc._id.toString();
  clearTimeout(timers.get(key));
  timers.delete(key);
  if (doc.status !== "active" || !doc.nextDeadlineAt) return;
  const delay = Math.max(0, doc.nextDeadlineAt.getTime() - Date.now()) + 30;
  const timer = setTimeout(() => {
    timers.delete(key);
    processDeadlines(io, doc._id).catch((error) => console.error("ludo deadline failed:", error));
  }, Math.min(delay, 2 ** 31 - 1));
  timer.unref?.();
  timers.set(key, timer);
}

// Everything that has run out of time in one game: the current turn and any reconnect window.
async function processDeadlines(io, gameId) {
  for (let round = 0; round < 6; round++) {
    const doc = await LudoGame.findOne({ _id: gameId, status: "active" });
    if (!doc) return;
    const now = Date.now();
    const state = doc.state;

    const gone = state.players.find(
      (player) => player.status === "ACTIVE" && !player.connected && player.disconnectedAt !== null && now - player.disconnectedAt >= state.rules.disconnectGraceMs,
    );
    let action = null;
    if (gone) action = { type: engine.ACTION.FORFEIT_DISCONNECTED, seat: gone.seat };
    else if (state.turnDeadline !== null && now >= state.turnDeadline) action = { type: engine.ACTION.TIMEOUT, seat: state.turnSeat };
    if (!action) {
      armDeadline(io, doc);
      return;
    }
    try {
      await runAction({ io, gameId: doc._id, action, system: true });
    } catch (error) {
      if (!(error instanceof GameError)) throw error;
      return;
    }
  }
}

function buildEventPayloads(doc, view, events) {
  const gameId = doc._id.toString();
  const base = { gameId, version: doc.state.version, serverNow: view.serverNow };
  const out = [["ludo:state", { ...base, events, game: view.game, results: view.results, status: view.status, finishedAt: view.finishedAt, durationSec: view.durationSec, finishReason: view.finishReason }]];
  const pick = (...types) => events.filter((event) => types.includes(event.type));
  const rolls = pick("DICE_ROLLED");
  if (rolls.length) out.push(["ludo:roll", { ...base, events: pick("DICE_ROLLED", "NO_MOVES", "SIXES_LIMIT") }]);
  const moves = pick("TOKEN_MOVED", "TOKEN_EXITED_HOME", "TOKEN_FINISHED");
  if (moves.length) out.push(["ludo:move", { ...base, events: moves }]);
  const captures = pick("TOKEN_CAPTURED");
  if (captures.length) out.push(["ludo:capture", { ...base, events: captures }]);
  if (pick("TURN_CHANGED", "EXTRA_TURN").length) {
    out.push(["ludo:turn", { ...base, seat: doc.state.turnSeat, turnNumber: doc.state.turnNumber, turnStartedAt: doc.state.turnStartedAt, turnDeadline: doc.state.turnDeadline, phase: doc.state.phase }]);
  }
  if (pick("TIMEOUT").length) out.push(["ludo:timer", { ...base, events: pick("TIMEOUT") }]);
  if (doc.status === "finished") out.push(["ludo:finished", { ...base, game: view.game, results: view.results, finishReason: view.finishReason, durationSec: view.durationSec }]);
  return out;
}

// Turns the engine's finished state into stored results and (exactly once) rewards.
function finalize(doc, next, now) {
  const variant = getVariant(doc.variantId);
  const count = next.players.length;
  const eligible =
    variant.leaderboardEnabled &&
    (next.finishReason === "WIN_CONDITION" || next.finishReason === "RANKING_COMPLETE") &&
    next.moveCount >= MIN_MOVES_FOR_REWARD &&
    new Set(next.players.map((player) => player.userId)).size === count;

  const rankings = next.rankings.map((row) => {
    const player = engine.playerBySeat(next, row.seat);
    // A player who walked away (left, went idle, never came back) earns nothing, however the others placed.
    const reward = eligible && row.result !== "FORFEIT" ? rewardFor(variant, count, row.rank) : { points: 0, xp: 0, coins: 0 };
    return {
      userId: new mongoose.Types.ObjectId(player.userId),
      seat: row.seat,
      rank: row.rank,
      result: row.result,
      captures: player.captures,
      tokensHome: engine.tokensHome(player),
      rewardPoints: reward.points,
      rewardXp: reward.xp,
      rewardCoins: reward.coins,
    };
  });
  const winner = rankings.find((row) => row.rank === 1 && row.result !== "DRAW");
  return {
    status: "finished",
    winnerId: winner ? winner.userId : null,
    rankings,
    finishReason: next.finishReason,
    rewardsGranted: eligible,
    finishedAt: new Date(now),
    durationSec: doc.startedAt ? Math.max(0, Math.round((now - doc.startedAt.getTime()) / 1000)) : null,
  };
}

/**
 * Applies one action to one game: loads it, asks the engine, stores the result
 * with a conditional update on the state version (so a concurrent action either
 * wins or is re-judged against the newer state — never both apply), then
 * broadcasts. `userId` (from the authenticated socket / session) picks the seat;
 * the client never names one. `system: true` is for the server's own timeouts.
 */
async function runAction({ io, gameId, userId = null, action, system = false }) {
  if (!mongoose.isValidObjectId(gameId)) throw notFound();
  const retries = action.expectedVersion === undefined ? 4 : 1;

  for (let attempt = 0; attempt < retries; attempt++) {
    const doc = await LudoGame.findById(gameId);
    if (!doc || (!system && !isMember(doc, userId))) throw notFound();
    if (doc.status !== "active") {
      if (doc.status === "lobby") throw new GameError(409, "GAME_NOT_STARTED", "The game hasn't started yet.");
      if (action.type === engine.ACTION.LEAVE_GAME) return { game: await gameView(doc) };
      throw new GameError(409, "GAME_NOT_ACTIVE", "This game is over.");
    }

    const state = doc.state;
    const seat = system ? action.seat : seatOfUser(state, userId);
    if (seat === null || seat === undefined) throw notFound();

    const now = Date.now();
    const result = engine.applyAction(state, { ...action, seat }, { now });
    if (!result.ok) {
      if (!system) noteInvalidAction(userId, doc._id, result.error.code);
      throw new GameError(409, result.error.code, result.error.message, { version: state.version });
    }
    if (result.duplicate) return { game: { ...(await gameView(doc)), mySeat: seat }, duplicate: true };

    const next = result.state;
    const $set = mirrorFields(next);
    const lastRoll = result.events.filter((event) => event.type === "DICE_ROLLED").at(-1);
    $set.diceResult = lastRoll ? lastRoll.value : doc.diceResult;
    if (next.phase === "FINISHED") Object.assign($set, finalize(doc, next, now));

    const updated = await LudoGame.findOneAndUpdate({ _id: doc._id, status: "active", stateVersion: state.version }, { $set }, { returnDocument: "after" });
    if (!updated) continue; // another action landed first — re-read and re-judge

    logEvents(updated, result.events, state);
    const view = await gameView(updated);
    for (const [event, payload] of buildEventPayloads(updated, view, result.events)) emit(io, gameRoom(updated._id), event, payload);
    if (updated.status === "active") armDeadline(io, updated);
    else {
      clearTimeout(timers.get(updated._id.toString()));
      timers.delete(updated._id.toString());
    }
    return { game: { ...view, mySeat: seat }, events: result.events };
  }
  throw new GameError(409, "STALE_VERSION", "The game has moved on — syncing.");
}

function logEvents(doc, events, previousState) {
  const gameId = doc._id.toString();
  for (const event of events) {
    if (event.type === "DICE_ROLLED") logLudo("dice_rolled", { gameId, seat: event.seat, value: event.value, auto: event.auto }, "debug");
    else if (event.type === "TOKEN_CAPTURED") logLudo("capture", { gameId, by: event.by, victim: event.victimSeat });
    else if (event.type === "TIMEOUT") logLudo("timeout", { gameId, seat: event.seat });
    else if (event.type === "PLAYER_LEFT") logLudo("player_left", { gameId, seat: event.seat, reason: event.reason });
    else if (event.type === "PLAYER_DISCONNECTED") logLudo("player_disconnect", { gameId, seat: event.seat });
    else if (event.type === "PLAYER_RECONNECTED") logLudo("reconnect", { gameId, seat: event.seat });
  }
  if (doc.status === "finished" && previousState.phase !== "FINISHED") {
    logLudo("game_completed", { gameId, variant: doc.variantId, reason: doc.finishReason, moves: doc.moveCount, durationSec: doc.durationSec, winnerId: doc.winnerId ? doc.winnerId.toString() : null });
    if (doc.rewardsGranted) {
      logLudo("reward_granted", { gameId, rewards: doc.rankings.map((row) => ({ userId: row.userId.toString(), points: row.rewardPoints, xp: row.rewardXp })) });
    }
  }
}

// Player-facing actions. The client sends an intention only.
const rollDice = (io, userId, gameId, { expectedVersion, actionId } = {}) =>
  runAction({ io, gameId, userId, action: { type: engine.ACTION.ROLL_DICE, expectedVersion, actionId } });

const selectToken = (io, userId, gameId, { tokenId, expectedVersion, actionId } = {}) =>
  runAction({ io, gameId, userId, action: { type: engine.ACTION.SELECT_TOKEN, tokenId, expectedVersion, actionId } });

// ---- Sockets: rooms, controllers, connection tracking ----------------------------------------------------------------------
const roomSockets = new Map(); // gameId -> Map(userId -> Set(socketId))
const controllers = new Map(); // `${gameId}:${userId}` -> socketId

function trackJoin(gameId, userId, socketId) {
  if (!roomSockets.has(gameId)) roomSockets.set(gameId, new Map());
  const users = roomSockets.get(gameId);
  if (!users.has(userId)) users.set(userId, new Set());
  users.get(userId).add(socketId);
  controllers.set(`${gameId}:${userId}`, socketId);
}

// Returns true when that was the user's last socket in the game.
function trackLeave(gameId, userId, socketId) {
  const users = roomSockets.get(gameId);
  const sockets = users?.get(userId);
  if (!sockets) return false;
  sockets.delete(socketId);
  if (controllers.get(`${gameId}:${userId}`) === socketId) {
    const another = [...sockets][0];
    if (another) controllers.set(`${gameId}:${userId}`, another);
    else controllers.delete(`${gameId}:${userId}`);
  }
  if (sockets.size) return false;
  users.delete(userId);
  if (!users.size) roomSockets.delete(gameId);
  return true;
}

// Only the tab that last joined the game may send its actions; older tabs are told to take over again.
function assertController(gameId, userId, socketId) {
  const current = controllers.get(`${gameId}:${userId}`);
  if (current && current !== socketId) throw new GameError(409, "NOT_CONTROLLER", "This game is open in another tab. Take control to keep playing here.");
}

async function joinGameRoom(userId, gameId, socket, io) {
  const doc = await findMemberGame(userId, gameId);
  const id = doc._id.toString();

  // A newer tab takes over control; the old one is told.
  const previous = controllers.get(`${id}:${userId}`);
  if (previous && previous !== socket.id) io?.to(previous).emit("ludo:takeover", { gameId: id });
  await socket.join(gameRoom(id));
  trackJoin(id, String(userId), socket.id);

  let current = doc;
  if (doc.status === "active") {
    const seat = seatOfUser(doc.state, userId);
    const player = doc.state.players.find((candidate) => candidate.seat === seat);
    if (player && !player.connected) {
      try {
        const result = await runAction({ io, gameId: id, userId, action: { type: engine.ACTION.RECONNECT } });
        current = await LudoGame.findById(id);
        void result;
      } catch (error) {
        if (!(error instanceof GameError)) throw error;
      }
    }
  }
  const view = { ...(await gameView(current)), mySeat: current.state ? seatOfUser(current.state, userId) : null, rematch: await rematchInfo(current, userId) };
  socket.to(gameRoom(id)).emit("ludo:joined", { gameId: id, userId: String(userId) });
  socket.emit("ludo:state", { gameId: id, version: current.stateVersion, events: [], game: view.game, results: view.results, status: view.status, finishedAt: view.finishedAt, durationSec: view.durationSec, finishReason: view.finishReason, serverNow: view.serverNow, snapshot: true });
  return { game: view };
}

// Called when a socket leaves a game room or disconnects: if that was the
// player's last connection to a live game, they are marked away (the reconnect
// window then runs on the server's clock).
async function handleRoomLeft(io, userId, gameId, socketId) {
  const last = trackLeave(gameId, String(userId), socketId);
  if (!last) return;
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, DISCONNECT_DEBOUNCE_MS);
    timer.unref?.();
  });
  if (roomSockets.get(gameId)?.has(String(userId))) return; // they came straight back
  try {
    const doc = await LudoGame.findById(gameId).select("status members");
    if (!doc || doc.status !== "active" || !isMember(doc, userId)) return;
    await runAction({ io, gameId, userId, action: { type: engine.ACTION.DISCONNECT } });
  } catch (error) {
    if (!(error instanceof GameError)) console.error("ludo disconnect handling failed:", error);
  }
}

function leaveRoom(socket, gameId) {
  return socket.leave(gameRoom(gameId));
}

// ---- Chat + reactions (never touch the game) -------------------------------------------------------------------------------
const lastChatAt = new Map();

async function prepareRelay(userId, gameId, kind, cooldown) {
  const doc = await findMemberGame(userId, gameId);
  if (doc.status === "cancelled") throw new GameError(409, "GAME_NOT_ACTIVE", "This game has ended.");
  const now = Date.now();
  const key = `${kind}:${userId}:${doc._id}`;
  if (now - (lastChatAt.get(key) || 0) < cooldown) throw new GameError(429, "RATE_LIMITED", "Slow down a little.");
  lastChatAt.set(key, now);
  if (lastChatAt.size > 1000) lastChatAt.delete(lastChatAt.keys().next().value);
  return { doc, now };
}

async function prepareChat(userId, gameId, text) {
  const clean = typeof text === "string" ? text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "";
  if (!clean) throw new GameError(400, "INVALID_MESSAGE", "Write something first.");
  if (clean.length > CHAT_MAX) throw new GameError(400, "INVALID_MESSAGE", `Keep it under ${CHAT_MAX} characters.`);
  const { doc, now } = await prepareRelay(userId, gameId, "chat", CHAT_COOLDOWN_MS);
  const users = await usersById([userId]);
  return { room: gameRoom(doc._id), payload: { gameId: doc._id.toString(), from: users.get(String(userId)) || { id: String(userId) }, text: clean, at: now } };
}

async function prepareReaction(userId, gameId, type) {
  if (typeof type !== "string" || !LUDO_REACTIONS.includes(type)) throw new GameError(400, "INVALID_REACTION", "That reaction isn't available.");
  const { doc, now } = await prepareRelay(userId, gameId, "reaction", REACTION_COOLDOWN_MS);
  return { room: gameRoom(doc._id), payload: { gameId: doc._id.toString(), from: String(userId), type, at: now } };
}

// ---- Rematch --------------------------------------------------------------------------------------------------------------------
async function requestRematch(user, gameId, io) {
  const previous = await findMemberGame(user._id, gameId);
  if (previous.status !== "finished") throw new GameError(409, "GAME_NOT_FINISHED", "Finish this game first.");

  // Someone already started the rematch: just go there.
  const existing = await LudoGame.findOne({ rematchOf: previous._id, status: { $in: ["lobby", "active"] } }).sort({ createdAt: -1 });
  if (existing) {
    if (isMember(existing, user._id)) return { game: await gameView(existing) };
    throw new GameError(409, "REMATCH_EXISTS", "A rematch has already been started — check your invitations.", { gameId: existing._id.toString() });
  }

  await assertNotBusy(user._id);
  const variant = onlineVariant(previous.variantId);
  const others = previous.rankings.filter((row) => row.userId.toString() !== user._id.toString() && row.result !== "FORFEIT").map((row) => row.userId);
  const targets = await User.find({ _id: { $in: others } }).select("fullName avatar settings");

  const invitable = [];
  for (const target of targets) {
    try {
      await assertCanInvite(user._id, target);
      if (!(await findBusyGame(target._id))) invitable.push(target);
    } catch (error) {
      if (!(error instanceof GameError)) throw error;
    }
  }
  if (!invitable.length) throw new GameError(409, "NO_ONE_AVAILABLE", "None of your opponents are online and free to play right now.");

  const doc = await LudoGame.create({
    variantId: variant.id,
    hostId: user._id,
    settings: { minPlayers: 2, maxPlayers: previous.rankings.length, autoStart: false },
    members: [{ userId: user._id, ready: true }],
    expectedPlayers: 1 + invitable.length,
    rematchOf: previous._id,
  });
  for (const target of invitable) {
    await createInviteRecord(io, { kind: "rematch", doc, inviter: user, target, ttl: REMATCH_TTL_MS }).catch((error) => {
      if (!(error instanceof GameError)) throw error;
    });
  }
  logLudo("game_created", { gameId: doc._id.toString(), variant: variant.id, hostId: user._id.toString(), rematchOf: previous._id.toString() });
  return { game: await gameView(await LudoGame.findById(doc._id)) };
}

// ---- History + statistics ---------------------------------------------------------------------------------------------------------
async function listHistory(userId, { page = 1 } = {}) {
  const pageNumber = Math.max(1, Math.floor(Number(page)) || 1);
  const me = new mongoose.Types.ObjectId(userId.toString());
  const [docs, total] = await Promise.all([
    LudoGame.find({ participantIds: me, status: "finished" })
      .sort({ finishedAt: -1 })
      .skip((pageNumber - 1) * HISTORY_PAGE_SIZE)
      .limit(HISTORY_PAGE_SIZE)
      .select("variantId startedAt finishedAt durationSec rankings finishReason rematchOf")
      .lean(),
    LudoGame.countDocuments({ participantIds: me, status: "finished" }),
  ]);
  const users = await usersById(docs.flatMap((doc) => doc.rankings.map((row) => row.userId)));
  const items = docs.map((doc) => {
    const mine = doc.rankings.find((row) => row.userId.toString() === me.toString());
    return {
      id: doc._id.toString(),
      variantId: doc.variantId,
      variantTitle: getVariant(doc.variantId)?.title || doc.variantId,
      finishedAt: doc.finishedAt,
      durationSec: doc.durationSec,
      playerCount: doc.rankings.length,
      opponents: doc.rankings.filter((row) => row.userId.toString() !== me.toString()).map((row) => users.get(row.userId.toString()) || { id: row.userId.toString() }),
      result: mine?.result || null,
      rank: mine?.rank ?? null,
      won: mine ? mine.rank === 1 && mine.result !== "DRAW" : false,
      captures: mine?.captures ?? 0,
      tokensHome: mine?.tokensHome ?? 0,
      rewardPoints: mine?.rewardPoints ?? 0,
      rewardXp: mine?.rewardXp ?? 0,
      // The change to the person's Games leaderboard points from this match.
      rankingChange: mine?.rewardPoints ?? 0,
      finishReason: doc.finishReason,
    };
  });
  return { items, page: pageNumber, limit: HISTORY_PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)) };
}

const levelForXp = (xp) => Math.floor(Math.sqrt(xp / 100)) + 1;

// Derived from trusted finished-match records only.
async function getStats(userId) {
  const me = new mongoose.Types.ObjectId(userId.toString());
  const rows = await LudoGame.aggregate([
    { $match: { participantIds: me, status: "finished" } },
    { $unwind: "$rankings" },
    { $match: { "rankings.userId": me } },
    { $sort: { finishedAt: 1 } },
    {
      $project: {
        variantId: 1,
        finishedAt: 1,
        rank: "$rankings.rank",
        result: "$rankings.result",
        captures: "$rankings.captures",
        tokensHome: "$rankings.tokensHome",
        points: "$rankings.rewardPoints",
        xp: "$rankings.rewardXp",
        coins: "$rankings.rewardCoins",
      },
    },
  ]);

  const stats = {
    played: 0, wins: 0, losses: 0, draws: 0, winRate: 0,
    totalCaptures: 0, tokensHome: 0, bestStreak: 0, currentStreak: 0,
    placements: { first: 0, second: 0, third: 0, fourth: 0 },
    points: 0, xp: 0, coins: 0, level: 1,
    byVariant: {},
  };
  let streak = 0;
  for (const row of rows) {
    const won = row.rank === 1 && row.result !== "DRAW";
    const draw = row.result === "DRAW";
    stats.played += 1;
    if (won) stats.wins += 1;
    else if (draw) stats.draws += 1;
    else stats.losses += 1;
    stats.totalCaptures += row.captures;
    stats.tokensHome += row.tokensHome;
    stats.points += row.points;
    stats.xp += row.xp;
    stats.coins += row.coins;
    if (getVariant(row.variantId)?.rankingEnabled && !draw) {
      const key = ["first", "second", "third", "fourth"][row.rank - 1];
      if (key) stats.placements[key] += 1;
    }
    streak = won ? streak + 1 : 0;
    stats.bestStreak = Math.max(stats.bestStreak, streak);
    const variant = (stats.byVariant[row.variantId] ||= { played: 0, wins: 0 });
    variant.played += 1;
    if (won) variant.wins += 1;
  }
  stats.currentStreak = streak;
  stats.winRate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  stats.level = levelForXp(stats.xp);
  return stats;
}

// Small per-user summary for lobby player cards.
async function playerCards(userIds) {
  const ids = userIds.map((id) => new mongoose.Types.ObjectId(String(id)));
  const rows = await LudoGame.aggregate([
    { $match: { status: "finished", participantIds: { $in: ids } } },
    { $unwind: "$rankings" },
    { $match: { "rankings.userId": { $in: ids } } },
    { $group: { _id: "$rankings.userId", played: { $sum: 1 }, wins: { $sum: { $cond: [{ $and: [{ $eq: ["$rankings.rank", 1] }, { $ne: ["$rankings.result", "DRAW"] }] }, 1, 0] } }, xp: { $sum: "$rankings.rewardXp" } } },
  ]);
  const byId = new Map(rows.map((row) => [row._id.toString(), row]));
  return Object.fromEntries(
    ids.map((id) => {
      const row = byId.get(id.toString()) || { played: 0, wins: 0, xp: 0 };
      return [id.toString(), { played: row.played, wins: row.wins, winRate: row.played ? Math.round((row.wins / row.played) * 100) : 0, level: levelForXp(row.xp) }];
    }),
  );
}

// ---- Analytics for admins (raw numbers, never shown to players) -----------------------------------------------------------------------
async function getAnalytics(since = new Date(Date.now() - 30 * 24 * 3600 * 1000)) {
  const [started, finished, byVariant, agg] = await Promise.all([
    LudoGame.countDocuments({ status: { $in: ["active", "finished"] }, startedAt: { $gte: since } }),
    LudoGame.countDocuments({ status: "finished", finishedAt: { $gte: since } }),
    LudoGame.aggregate([{ $match: { startedAt: { $gte: since }, status: { $in: ["active", "finished"] } } }, { $group: { _id: "$variantId", matches: { $sum: 1 } } }, { $sort: { matches: -1 } }]),
    LudoGame.aggregate([
      { $match: { status: "finished", finishedAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          avgDurationSec: { $avg: "$durationSec" },
          forfeits: { $sum: { $cond: [{ $eq: ["$finishReason", "FORFEIT"] }, 1, 0] } },
          timeouts: { $sum: { $sum: { $map: { input: { $ifNull: ["$state.players", []] }, as: "p", in: "$$p.timeoutsTotal" } } } },
          turns: { $sum: "$moveCount" },
          captures: { $sum: { $sum: "$rankings.captures" } },
          tokensHome: { $sum: { $sum: "$rankings.tokensHome" } },
          players: { $sum: { $size: "$rankings" } },
        },
      },
    ]),
  ]);
  const a = agg[0] || {};
  return {
    since,
    matchesStarted: started,
    matchesCompleted: finished,
    averageDurationSec: Math.round(a.avgDurationSec || 0),
    abandonRate: finished ? Number(((a.forfeits || 0) / finished).toFixed(3)) : 0,
    timeoutsPerMatch: finished ? Number(((a.timeouts || 0) / finished).toFixed(2)) : 0,
    mostPlayedVariant: byVariant[0]?._id || null,
    byVariant: byVariant.map((row) => ({ variantId: row._id, matches: row.matches })),
    averageCapturesPerMatch: finished ? Number(((a.captures || 0) / finished).toFixed(2)) : 0,
    averageTokensHomePerPlayer: a.players ? Number(((a.tokensHome || 0) / a.players).toFixed(2)) : 0,
  };
}

// ---- Background: deadlines and housekeeping -----------------------------------------------------------------------------------------------
async function sweep(io) {
  const now = new Date();
  const due = await LudoGame.find({ status: "active", nextDeadlineAt: { $lte: new Date(now.getTime() + SWEEP_MS + 5000) } }).select("_id nextDeadlineAt status").limit(100);
  for (const doc of due) {
    if (doc.nextDeadlineAt <= now) processDeadlines(io, doc._id).catch((error) => console.error("ludo sweep failed:", error));
    else if (!timers.has(doc._id.toString())) armDeadline(io, doc);
  }
  const stale = await LudoGame.find({ status: "lobby", updatedAt: { $lt: new Date(now.getTime() - LOBBY_IDLE_MS) } }).select("_id members");
  for (const doc of stale) {
    const cancelled = await LudoGame.findOneAndUpdate({ _id: doc._id, status: "lobby" }, { $set: { status: "cancelled", finishedAt: now } });
    if (!cancelled) continue;
    await cancelPendingInvites(io, doc._id);
    for (const member of doc.members) emit(io, userRoom(member.userId), "ludo:lobby:closed", { gameId: doc._id.toString(), reason: "IDLE" });
  }
}

let sweeper = null;
function startLudoScheduler(io) {
  if (sweeper) return;
  const run = () => sweep(io).catch((error) => console.error("ludo scheduler failed:", error));
  run();
  sweeper = setInterval(run, SWEEP_MS);
  sweeper.unref?.();
}

module.exports = {
  sweep,
  INVITE_TTL_MS,
  LUDO_REACTIONS,
  ludoEnabled,
  variantEnabled,
  gameRoom,
  userRoom,
  listCatalog,
  createLobby,
  updateLobbySettings,
  setReady,
  startLobby,
  createInvite,
  acceptInvite,
  declineInvite,
  cancelInvite,
  listPendingInvites,
  leaveGame,
  getGame,
  listActive,
  listOnlineFriendsFor,
  rollDice,
  selectToken,
  runAction,
  requestRematch,
  joinGameRoom,
  leaveRoom,
  handleRoomLeft,
  assertController,
  prepareChat,
  prepareReaction,
  listHistory,
  getStats,
  playerCards,
  getAnalytics,
  processDeadlines,
  startLudoScheduler,
  logLudo,
};
