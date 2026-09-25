const { GameError } = require("../services/games/GameError");
const service = require("../services/gameChallenge.service");
const User = require("../models/User");
const { ACTIONS, assertUserCan } = require("../utils/moderation");

// Client -> server friend-challenge events, registered on the EXISTING Socket.IO
// server for every authenticated socket (see server.js — no second server).
// `socket.userId` was set by the existing handshake auth (the signed kotha_token
// cookie); it is the only identity used here, never anything the client sends.
// Each event calls the same service function as its REST twin.
//
//   gameChallenge:send      { userId, gameType }          -> ack { ok, invite }
//   gameChallenge:accept    { requestId, kind? }          -> ack { ok, match }
//   gameChallenge:decline   { requestId, kind? }          -> ack { ok }
//   gameChallenge:join      { matchId }                   -> ack { ok, match }   (joins the match room)
//   gameChallenge:room:leave{ matchId }                   -> stop receiving that match's room events
//   gameChallenge:answer    { matchId, questionIndex, selectedPosition } -> ack { ok, match }
//   gameChallenge:leave     { matchId }                   -> leave (abandon) the match
//   gameChallenge:rematch   { matchId }                   -> ack { ok, invite }
//
// Server -> client events (invite, accepted, declined, started, question,
// answer, questionResult, finished, player:left, rematch, rematchAccepted,
// rematchDeclined, …) are emitted by gameChallenge.service.js.
const reply = (ack, payload) => {
  if (typeof ack === "function") ack(payload);
};

const toError = (error) => {
  if (error instanceof GameError) return { ok: false, error: { code: error.code, message: error.message, ...error.extra } };
  console.error("game challenge socket error:", error);
  return { ok: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong." } };
};

const kindOf = (payload) => (payload?.kind === "rematch" ? "rematch" : "invite");

function registerGameChallengeSocket(io, socket) {
  // Acting user as a full document (the service reads settings/name from it).
  const actor = () => User.findById(socket.userId).select("fullName avatar settings");

  // Events that play or start a game are refused for banned / muted accounts
  // (the same GAME_PLAY policy the REST routes use).
  const PLAYING = new Set(["gameChallenge:send", "gameChallenge:accept", "gameChallenge:answer", "gameChallenge:rematch"]);

  const handle = (event, fn) =>
    socket.on(event, async (payload, ack) => {
      try {
        if (PLAYING.has(event)) await assertUserCan(socket.userId, ACTIONS.GAME_PLAY);
        reply(ack, { ok: true, ...(await fn(payload || {})) });
      } catch (error) {
        reply(ack, toError(error));
      }
    });

  handle("gameChallenge:send", async (p) => ({ invite: await service.createInvite(await actor(), p.userId, p.gameType, io) }));
  handle("gameChallenge:accept", async (p) => service.acceptRequest(await actor(), p.requestId, io, kindOf(p)));
  handle("gameChallenge:decline", async (p) => service.declineRequest(await actor(), p.requestId, io, kindOf(p)));
  handle("gameChallenge:join", (p) => service.joinMatchRoom(socket.userId, p.matchId, socket, io));
  handle("gameChallenge:answer", (p) =>
    service.submitAnswer(socket.userId, p.matchId, { questionIndex: p.questionIndex, selectedPosition: p.selectedPosition }, io, Date.now()),
  );
  handle("gameChallenge:leave", (p) => service.leaveMatch(socket.userId, p.matchId, io));
  handle("gameChallenge:rematch", async (p) => ({ invite: await service.requestRematch(await actor(), p.matchId, io) }));

  socket.on("gameChallenge:room:leave", (payload) => {
    if (typeof payload?.matchId === "string") socket.leave(service.matchRoom(payload.matchId));
  });
}

module.exports = { registerGameChallengeSocket };
