const { GameError } = require("../services/games/GameError");
const service = require("../services/call.service");
const { ACTIONS, assertUserCan } = require("../utils/moderation");

// Client -> server call events, registered on the EXISTING Socket.IO server
// for every authenticated socket (see server.js — no second server and no
// media ever crosses this transport, only signalling/control). Mirrors the
// games/ludo socket's guarded-handler pattern.
//
//   call:join            { callId }               -> ack { ok, call }
//   call:offer            { callId, sdp, renegotiate? }
//   call:answer           { callId, sdp, renegotiate? }
//   call:ice-candidate    { callId, candidate }
//   call:state            { callId, status }       -> ack { ok, call }   (connecting/connected/reconnecting)
//   call:screen-share:start { callId }             -> ack { ok, call }
//   call:screen-share:stop  { callId }             -> ack { ok, call }
//   call:reaction          { callId, type }
//
// Server -> client events (invite, accepted, declined, cancelled, missed,
// signal, state, ended, screen-share, reaction) are emitted by call.service.js.
const reply = (ack, payload) => {
  if (typeof ack === "function") ack(payload);
};

const toError = (error) => {
  if (error instanceof GameError) return { ok: false, error: { code: error.code, message: error.message, ...error.extra } };
  console.error("call socket error:", error);
  return { ok: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong." } };
};

const text = (value) => (typeof value === "string" ? value.slice(0, 64) : null);

function registerCallSocket(io, socket) {
  const guarded = (handler) => async (payload, ack) => {
    try {
      await assertUserCan(socket.userId, ACTIONS.CALL);
      const callId = text(payload?.callId);
      reply(ack, { ok: true, ...(await handler(callId, payload || {})) });
    } catch (error) {
      reply(ack, toError(error));
    }
  };

  socket.on(
    "call:join",
    guarded(async (callId) => ({ call: await service.joinCallRoom({ _id: socket.userId }, callId, socket, io) })),
  );

  const relay = (type) =>
    guarded(async (callId, payload) => {
      const signal = type === "ice" ? { type, candidate: payload.candidate } : { type, sdp: payload.sdp, renegotiate: Boolean(payload.renegotiate) };
      await service.relaySignal({ _id: socket.userId }, callId, io, signal);
      return {};
    });
  socket.on("call:offer", relay("offer"));
  socket.on("call:answer", relay("answer"));
  socket.on("call:ice-candidate", relay("ice"));

  socket.on(
    "call:state",
    guarded(async (callId, payload) => ({ call: await service.reportState({ _id: socket.userId }, callId, io, payload.status) })),
  );
  socket.on(
    "call:screen-share:start",
    guarded(async (callId) => ({ call: await service.setScreenShare({ _id: socket.userId }, callId, io, true) })),
  );
  socket.on(
    "call:screen-share:stop",
    guarded(async (callId) => ({ call: await service.setScreenShare({ _id: socket.userId }, callId, io, false) })),
  );
  socket.on(
    "call:reaction",
    guarded(async (callId, payload) => {
      await service.sendReaction({ _id: socket.userId }, callId, io, text(payload.type));
      return {};
    }),
  );
}

module.exports = { registerCallSocket };
