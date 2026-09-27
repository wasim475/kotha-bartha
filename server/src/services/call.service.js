const mongoose = require("mongoose");
const Call = require("../models/Call");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const Friendship = require("../models/Friendship");
const { GameError } = require("./games/GameError");
const { pairKey } = require("../utils/ids");
const { isBlockedEitherWay } = require("../utils/blocks");
const { isReachable } = require("./ticTacToe.service");
const { safeUser } = require("../utils/serializers");
const { clearHiddenFor, bumpUnreadFor } = require("../utils/conversationHelpers");
const { createNotification } = require("./notification.service");

// Server-authoritative 1-to-1 calling. The client never supplies a call id it
// doesn't own, a participant identity, or a state transition that isn't one
// of the explicit actions below — every mutation is a conditional
// findOneAndUpdate keyed on the call's CURRENT status, so two racing
// requests (both users hanging up, a cancel racing an accept, ...) can only
// ever have one winner and the loser gets a clean, harmless "already
// answered" style response instead of corrupting the call.

// How long a call rings before it's "missed", and how long "reconnecting" is
// tolerated before the call is failed — configurable (mainly for tests) via
// CALL_RING_TIMEOUT_MS / CALL_RECONNECT_TIMEOUT_MS, same pattern as the
// messaging feature's UNSEND_WINDOW_MINUTES (server/src/utils/config.js).
const RING_TIMEOUT_MS = Number(process.env.CALL_RING_TIMEOUT_MS) || 45_000;
const RECONNECT_TIMEOUT_MS = Number(process.env.CALL_RECONNECT_TIMEOUT_MS) || 30_000;
const REACTION_COOLDOWN_MS = 350;
const REACTIONS = new Set(["heart", "thumbsup", "laugh", "wow", "sad", "fire"]);

const userRoom = (userId) => `user:${userId}`;
const callRoom = (callId) => `call:${callId}`;
const emit = (io, room, event, payload) => io?.to(room).emit(event, payload);
const notFound = () => new GameError(404, "NOT_FOUND", "Call not found.");
const fakeReq = (io) => ({ app: { get: () => io } });

const ACTIVE_STATUSES = ["ringing", "accepted", "connecting", "connected", "reconnecting"];
const ANSWERED_STATUSES = ["accepted", "connecting", "connected", "reconnecting"];

// Per-call timers live only in this process's memory (mirroring the Ludo
// invite-expiry scheduler) — acceptable for the same reason it is there: a
// server restart mid-call is rare, and the worst case is a call that never
// auto-resolves to "missed"/"failed" until a participant ends it by hand.
const ringTimers = new Map();
const reconnectTimers = new Map();
const lastReactionAt = new Map();

function clearCallTimers(callId) {
  clearTimeout(ringTimers.get(callId));
  clearTimeout(reconnectTimers.get(callId));
  ringTimers.delete(callId);
  reconnectTimers.delete(callId);
}

// ---- Serialization ---------------------------------------------------------------------------

async function summarize(call, users) {
  const caller = users.get(call.callerId.toString());
  const callee = users.get(call.calleeId.toString());
  return {
    id: call._id.toString(),
    conversationId: call.conversationId.toString(),
    video: call.video,
    status: call.status,
    caller: caller ? safeUser(caller) : { id: call.callerId.toString() },
    callee: callee ? safeUser(callee) : { id: call.calleeId.toString() },
    screenShare: call.screenShare?.active ? { active: true, byUserId: call.screenShare.byUserId?.toString() || null } : { active: false, byUserId: null },
    createdAt: call.createdAt,
    acceptedAt: call.acceptedAt || null,
    connectedAt: call.connectedAt || null,
    endedAt: call.endedAt || null,
    durationSec: call.durationSec || 0,
  };
}

async function serializeCall(call) {
  const users = await User.find({ _id: { $in: [call.callerId, call.calleeId] } }).select("fullName avatar");
  return summarize(call, new Map(users.map((user) => [user._id.toString(), user])));
}

const forUser = (call, userId) => ({
  ...call,
  role: call.caller.id === String(userId) ? "caller" : "callee",
  peer: call.caller.id === String(userId) ? call.callee : call.caller,
});

// ---- Guards -----------------------------------------------------------------------------------

async function assertCanCall(callerId, target) {
  if (!(await Friendship.exists({ pairKey: pairKey(callerId, target._id) }))) {
    throw new GameError(403, "NOT_FRIENDS", "You can only call your friends.");
  }
  if (await isBlockedEitherWay(callerId, target._id)) throw new GameError(403, "BLOCKED", "You can't call this user.");
  if (!isReachable(target._id)) throw new GameError(409, "TARGET_OFFLINE", `${target.fullName} isn't online right now.`);
}

async function findActiveCall(userId) {
  return Call.findOne({ status: { $in: ACTIVE_STATUSES }, $or: [{ callerId: userId }, { calleeId: userId }] }).sort({ createdAt: -1 });
}

async function assertNotBusy(userId) {
  const busy = await findActiveCall(userId);
  if (busy) throw new GameError(409, "ALREADY_IN_CALL", "You're already in a call.", { callId: busy._id.toString(), status: busy.status });
}

function assertParticipant(call, userId) {
  const id = String(userId);
  if (call.callerId.toString() !== id && call.calleeId.toString() !== id) throw notFound();
}

const otherPartyId = (call, userId) => (call.callerId.toString() === String(userId) ? call.calleeId : call.callerId);

// ---- Conversation + call-log message (mirrors the old client-reported route, server-driven now) --

async function ensureConversation(userIdA, userIdB) {
  const key = pairKey(userIdA, userIdB);
  return Conversation.findOneAndUpdate(
    { pairKey: key },
    { $setOnInsert: { participantIds: [userIdA, userIdB], pairKey: key } },
    { new: true, upsert: true },
  );
}

const CALL_BODY = {
  completed: (video, duration) => {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${video ? "Video" : "Audio"} call · ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  },
  declined: (video) => `${video ? "Video" : "Audio"} call declined`,
  missed: (video) => `Missed ${video ? "video" : "audio"} call`,
  cancelled: (video) => `Missed ${video ? "video" : "audio"} call`,
};

async function recordCallMessage(io, call, outcome) {
  const conversation = await Conversation.findById(call.conversationId);
  if (!conversation) return;
  const recipientId = call.calleeId;
  const body = CALL_BODY[outcome](call.video, call.durationSec || 0);

  clearHiddenFor(conversation, [call.callerId, call.calleeId]);

  const message = await Message.create({
    conversationId: conversation._id,
    senderId: call.callerId,
    recipientId,
    body,
    type: "call",
    call: { outcome, durationSec: outcome === "completed" ? call.durationSec || 0 : 0, video: call.video },
    status: "delivered",
  });

  conversation.lastMessage = body;
  conversation.lastMessageAt = message.createdAt;
  conversation.lastMessageId = message._id;
  bumpUnreadFor(conversation, [recipientId]);
  await conversation.save();

  const caller = await User.findById(call.callerId).select("fullName avatar");
  const payload = {
    id: message._id.toString(),
    conversationId: conversation._id.toString(),
    body: message.body,
    type: "call",
    call: message.call,
    createdAt: message.createdAt,
    senderId: call.callerId.toString(),
    sender: caller ? safeUser(caller) : { id: call.callerId.toString() },
    unsendExpiresAt: null,
    forwardedFrom: null,
    status: message.status,
    replyTo: null,
    reactions: [],
  };
  emit(io, userRoom(recipientId), "message:new", payload);
  emit(io, userRoom(call.callerId), "message:new", payload);
}

async function notifyMissedCall(io, call) {
  try {
    const caller = await User.findById(call.callerId).select("fullName avatar");
    await createNotification(fakeReq(io), {
      recipientId: call.calleeId,
      actorId: call.callerId,
      type: "missed_call",
      entityType: "call",
      entityId: call._id,
      payload: { message: `${caller?.fullName || "A friend"} tried to ${call.video ? "video " : ""}call you.`, conversationId: call.conversationId.toString(), video: call.video },
      uniqueEventId: `missed_call:${call._id.toString()}`,
    });
  } catch (error) {
    console.error("missed call notification failed:", error);
  }
}

// ---- Ring / reconnect timeouts ------------------------------------------------------------------

function scheduleRingTimeout(io, callId) {
  const timer = setTimeout(async () => {
    ringTimers.delete(callId.toString());
    try {
      const call = await Call.findOneAndUpdate({ _id: callId, status: "ringing" }, { $set: { status: "missed", endedAt: new Date() } }, { new: true });
      if (!call) return;
      await recordCallMessage(io, call, "missed");
      emit(io, userRoom(call.callerId), "call:missed", { callId: call._id.toString() });
      emit(io, userRoom(call.calleeId), "call:missed", { callId: call._id.toString() });
      await notifyMissedCall(io, call);
    } catch (error) {
      console.error("call ring timeout failed:", error);
    }
  }, RING_TIMEOUT_MS);
  ringTimers.set(callId.toString(), timer);
}

function scheduleReconnectTimeout(io, callId) {
  clearTimeout(reconnectTimers.get(callId.toString()));
  const timer = setTimeout(async () => {
    reconnectTimers.delete(callId.toString());
    try {
      const call = await Call.findOneAndUpdate({ _id: callId, status: "reconnecting" }, { $set: { status: "failed", endedAt: new Date() } }, { new: true });
      if (!call) return;
      finalizeDuration(call);
      await call.save();
      await recordCallMessage(io, call, "completed");
      const summary = await serializeCall(call);
      emit(io, callRoom(call._id), "call:ended", { callId: call._id.toString(), reason: "failed", call: summary });
    } catch (error) {
      console.error("call reconnect timeout failed:", error);
    }
  }, RECONNECT_TIMEOUT_MS);
  reconnectTimers.set(callId.toString(), timer);
}

function finalizeDuration(call) {
  call.durationSec = call.acceptedAt ? Math.max(0, Math.round((Date.now() - call.acceptedAt.getTime()) / 1000)) : 0;
}

// ---- Actions ------------------------------------------------------------------------------------

async function initiateCall(caller, targetId, { video = true } = {}, io) {
  if (!mongoose.isValidObjectId(targetId)) throw new GameError(400, "INVALID_USER", "Choose a friend to call.");
  if (targetId.toString() === caller._id.toString()) throw new GameError(400, "INVALID_USER", "You can't call yourself.");

  const target = await User.findById(targetId).select("fullName avatar settings accountStatus isMuted");
  if (!target || target.accountStatus === "deleted") throw new GameError(404, "NOT_FOUND", "User not found.");

  await assertNotBusy(caller._id);
  const targetBusy = await findActiveCall(target._id);
  if (targetBusy) throw new GameError(409, "TARGET_BUSY", `${target.fullName} is already in a call.`, { callId: targetBusy._id.toString() });

  await assertCanCall(caller._id, target);

  const conversation = await ensureConversation(caller._id, target._id);
  const call = await Call.create({ callerId: caller._id, calleeId: target._id, conversationId: conversation._id, video: Boolean(video), status: "ringing" });

  scheduleRingTimeout(io, call._id);
  const summary = await serializeCall(call);
  emit(io, userRoom(target._id), "call:invite", { call: summary });
  return summary;
}

async function getActiveCall(userId) {
  const call = await findActiveCall(userId);
  return call ? serializeCall(call) : null;
}

async function getCall(userId, callId) {
  if (!mongoose.isValidObjectId(callId)) throw notFound();
  const call = await Call.findById(callId);
  if (!call) throw notFound();
  assertParticipant(call, userId);
  return serializeCall(call);
}

async function acceptCall(user, callId, io) {
  if (!mongoose.isValidObjectId(callId)) throw notFound();
  const call = await Call.findOneAndUpdate(
    { _id: callId, calleeId: user._id, status: "ringing" },
    { $set: { status: "accepted", acceptedAt: new Date() } },
    { new: true },
  );
  if (!call) {
    const existing = await Call.findById(callId);
    if (!existing || !existing.calleeId.equals(user._id)) throw notFound();
    throw new GameError(409, "CALL_UNAVAILABLE", "This call is no longer available.", { status: existing.status });
  }
  clearCallTimers(call._id.toString());
  const summary = await serializeCall(call);
  emit(io, userRoom(call.callerId), "call:accepted", { call: summary });
  // My own other tabs/devices: close their copy of the incoming-call popup.
  emit(io, userRoom(call.calleeId), "call:accepted", { call: summary });
  return summary;
}

async function declineCall(user, callId, io) {
  if (!mongoose.isValidObjectId(callId)) throw notFound();
  const call = await Call.findOneAndUpdate(
    { _id: callId, calleeId: user._id, status: "ringing" },
    { $set: { status: "declined", endedAt: new Date() } },
    { new: true },
  );
  if (!call) return { ok: true };
  clearCallTimers(call._id.toString());
  await recordCallMessage(io, call, "declined");
  emit(io, userRoom(call.callerId), "call:declined", { callId: call._id.toString() });
  emit(io, userRoom(call.calleeId), "call:declined", { callId: call._id.toString() });
  return serializeCall(call);
}

async function cancelCall(user, callId, io) {
  if (!mongoose.isValidObjectId(callId)) throw notFound();
  const call = await Call.findOneAndUpdate(
    { _id: callId, callerId: user._id, status: "ringing" },
    { $set: { status: "cancelled", endedAt: new Date() } },
    { new: true },
  );
  if (!call) return { ok: true };
  clearCallTimers(call._id.toString());
  await recordCallMessage(io, call, "cancelled");
  emit(io, userRoom(call.calleeId), "call:cancelled", { callId: call._id.toString() });
  emit(io, userRoom(call.callerId), "call:cancelled", { callId: call._id.toString() });
  return serializeCall(call);
}

async function endCall(user, callId, io) {
  if (!mongoose.isValidObjectId(callId)) throw notFound();
  const call = await Call.findById(callId);
  if (!call) throw notFound();
  assertParticipant(call, user._id);

  if (call.status === "ringing") return call.callerId.equals(user._id) ? cancelCall(user, callId, io) : declineCall(user, callId, io);
  if (!ANSWERED_STATUSES.includes(call.status)) return serializeCall(call); // already ended — idempotent

  const updated = await Call.findOneAndUpdate(
    { _id: callId, status: { $in: ANSWERED_STATUSES } },
    { $set: { status: "ended", endedAt: new Date(), endedBy: user._id } },
    { new: true },
  );
  if (!updated) return serializeCall(await Call.findById(callId)); // lost the race — other side already ended it

  clearCallTimers(updated._id.toString());
  finalizeDuration(updated);
  await updated.save();
  await recordCallMessage(io, updated, "completed");
  const summary = await serializeCall(updated);
  emit(io, callRoom(updated._id), "call:ended", { callId: updated._id.toString(), reason: "ended", call: summary });
  emit(io, userRoom(otherPartyId(updated, user._id)), "call:ended", { callId: updated._id.toString(), reason: "ended", call: summary });
  return summary;
}

const STATE_TRANSITIONS = {
  connecting: ["accepted", "connecting", "reconnecting"],
  connected: ["accepted", "connecting", "connected", "reconnecting"],
  reconnecting: ["connected", "reconnecting"],
};

async function reportState(user, callId, io, nextState) {
  if (!["connecting", "connected", "reconnecting"].includes(nextState)) throw new GameError(400, "INVALID_STATE", "Unknown call state.");
  if (!mongoose.isValidObjectId(callId)) throw notFound();
  const call = await Call.findById(callId);
  if (!call) throw notFound();
  assertParticipant(call, user._id);
  if (!STATE_TRANSITIONS[nextState].includes(call.status)) return serializeCall(call); // stale/duplicate report — ignore quietly

  const set = { status: nextState };
  if (nextState === "connected" && !call.connectedAt) set.connectedAt = new Date();
  const updated = await Call.findOneAndUpdate({ _id: callId, status: call.status }, { $set: set }, { new: true });
  if (!updated) return serializeCall(call);

  if (nextState === "reconnecting") scheduleReconnectTimeout(io, updated._id);
  else {
    clearTimeout(reconnectTimers.get(updated._id.toString()));
    reconnectTimers.delete(updated._id.toString());
  }

  emit(io, callRoom(updated._id), "call:state", { callId: updated._id.toString(), status: updated.status, by: user._id.toString(), connectedAt: updated.connectedAt || null });
  return serializeCall(updated);
}

async function relaySignal(user, callId, io, signal) {
  if (!mongoose.isValidObjectId(callId)) throw notFound();
  const call = await Call.findById(callId).select("callerId calleeId status");
  if (!call) throw notFound();
  assertParticipant(call, user._id);
  if (!ANSWERED_STATUSES.includes(call.status)) throw new GameError(409, "CALL_NOT_ACTIVE", "This call isn't active.");
  emit(io, userRoom(otherPartyId(call, user._id)), "call:signal", { callId: call._id.toString(), from: user._id.toString(), signal });
}

async function setScreenShare(user, callId, io, active) {
  if (!mongoose.isValidObjectId(callId)) throw notFound();
  const call = await Call.findById(callId);
  if (!call) throw notFound();
  assertParticipant(call, user._id);
  if (!ANSWERED_STATUSES.includes(call.status)) throw new GameError(409, "CALL_NOT_ACTIVE", "This call isn't active.");

  if (active) {
    if (call.screenShare?.active && !call.screenShare.byUserId?.equals(user._id)) {
      throw new GameError(409, "SCREEN_SHARE_BUSY", "The other person is already sharing their screen.");
    }
    call.screenShare = { active: true, byUserId: user._id };
  } else {
    if (!call.screenShare?.byUserId?.equals(user._id)) return serializeCall(call);
    call.screenShare = { active: false, byUserId: null };
  }
  await call.save();
  emit(io, callRoom(call._id), active ? "call:screen-share:start" : "call:screen-share:stop", { callId: call._id.toString(), byUserId: user._id.toString() });
  return serializeCall(call);
}

async function sendReaction(user, callId, io, type) {
  if (!REACTIONS.has(type)) throw new GameError(400, "INVALID_REACTION", "Unknown reaction.");
  const key = `${callId}:${user._id}`;
  const last = lastReactionAt.get(key) || 0;
  if (Date.now() - last < REACTION_COOLDOWN_MS) return; // silently throttled, like Ludo/Tic-Tac-Toe reactions
  lastReactionAt.set(key, Date.now());

  if (!mongoose.isValidObjectId(callId)) throw notFound();
  const call = await Call.findById(callId).select("callerId calleeId status");
  if (!call) throw notFound();
  assertParticipant(call, user._id);
  if (!ANSWERED_STATUSES.includes(call.status)) throw new GameError(409, "CALL_NOT_ACTIVE", "This call isn't active.");
  emit(io, callRoom(call._id), "call:reaction", { callId: call._id.toString(), from: user._id.toString(), type });
}

async function joinCallRoom(user, callId, socket) {
  if (!mongoose.isValidObjectId(callId)) throw notFound();
  const call = await Call.findById(callId);
  if (!call) throw notFound();
  assertParticipant(call, user._id);
  if (!ANSWERED_STATUSES.includes(call.status) && call.status !== "ringing") throw new GameError(409, "CALL_NOT_ACTIVE", "This call has ended.");
  socket.join(callRoom(call._id));
  return serializeCall(call);
}

// ---- History --------------------------------------------------------------------------------

async function getHistory(userId, { page = 1 } = {}) {
  const pageSize = 30;
  const pageNumber = Math.max(1, Number(page) || 1);
  const query = { $or: [{ callerId: userId }, { calleeId: userId }], status: { $ne: "ringing" } };
  const [calls, total] = await Promise.all([
    Call.find(query).sort({ createdAt: -1 }).skip((pageNumber - 1) * pageSize).limit(pageSize).lean(),
    Call.countDocuments(query),
  ]);
  const otherIds = [...new Set(calls.map((call) => (call.callerId.toString() === String(userId) ? call.calleeId : call.callerId).toString()))];
  const users = await User.find({ _id: { $in: otherIds } }).select("fullName avatar");
  const byId = new Map(users.map((user) => [user._id.toString(), user]));

  return {
    page: pageNumber,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    calls: calls.map((call) => {
      const outgoing = call.callerId.toString() === String(userId);
      const other = byId.get((outgoing ? call.calleeId : call.callerId).toString());
      return {
        id: call._id.toString(),
        direction: outgoing ? "outgoing" : "incoming",
        video: call.video,
        status: call.status,
        with: other ? safeUser(other) : null,
        durationSec: call.durationSec || 0,
        createdAt: call.createdAt,
        acceptedAt: call.acceptedAt || null,
        endedAt: call.endedAt || null,
      };
    }),
  };
}

module.exports = {
  initiateCall,
  getActiveCall,
  getCall,
  acceptCall,
  declineCall,
  cancelCall,
  endCall,
  reportState,
  relaySignal,
  setScreenShare,
  sendReaction,
  joinCallRoom,
  getHistory,
  forUser,
};
