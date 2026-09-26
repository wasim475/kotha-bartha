const { GameError } = require("../services/games/GameError");
const service = require("../services/ludo.service");
const { ACTIONS, assertUserCan } = require("../utils/moderation");

// Client -> server Ludo events, registered on the EXISTING Socket.IO server for
// every authenticated socket (see server.js — no second server). `socket.userId`
// was set by the existing handshake auth (the signed kotha_token cookie); it is
// the only identity used here, never anything the client sends, and the client
// never names a seat, a dice value or a position.
//
//   ludo:join     { gameId }                            -> ack { ok, game }
//   ludo:leave    { gameId }                            -> stop receiving that game's events
//   ludo:ready    { gameId, ready }                     -> ack { ok, game }
//   ludo:start    { gameId }                            -> ack { ok, game }        (host)
//   ludo:roll     { gameId, expectedVersion, actionId } -> ack { ok, game, events }
//   ludo:move     { gameId, tokenId, expectedVersion, actionId } -> ack { ok, game, events }
//   ludo:chat     { gameId, text }                      -> ack { ok }
//   ludo:reaction { gameId, type }                      -> ack { ok }
//
// Server -> client events (invite, lobby, started, state, roll, move, capture,
// turn, timer, finished, takeover, rematch…) are emitted by ludo.service.js.
const reply = (ack, payload) => {
  if (typeof ack === "function") ack(payload);
};

const toError = (error) => {
  if (error instanceof GameError) return { ok: false, error: { code: error.code, message: error.message, ...error.extra } };
  console.error("ludo socket error:", error);
  return { ok: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong." } };
};

const text = (value) => (typeof value === "string" ? value.slice(0, 64) : null);

function registerLudoSocket(io, socket) {
  const guarded = (handler, { action = ACTIONS.GAME_PLAY, control = false } = {}) => async (payload, ack) => {
    try {
      await assertUserCan(socket.userId, action);
      const gameId = text(payload?.gameId);
      if (control) service.assertController(gameId, String(socket.userId), socket.id);
      reply(ack, { ok: true, ...(await handler(gameId, payload || {})) });
    } catch (error) {
      reply(ack, toError(error));
    }
  };

  // Only the game's own participants can enter its room; anyone else (or a made-up id) gets a plain "not found".
  socket.on("ludo:join", async (payload, ack) => {
    try {
      await assertUserCan(socket.userId, ACTIONS.GAME_PLAY);
      const { game } = await service.joinGameRoom(socket.userId, text(payload?.gameId), socket, io);
      reply(ack, { ok: true, game });
    } catch (error) {
      reply(ack, toError(error));
    }
  });

  socket.on("ludo:leave", async (payload) => {
    const gameId = text(payload?.gameId);
    if (!gameId) return;
    await service.leaveRoom(socket, gameId);
    service.handleRoomLeft(io, socket.userId, gameId, socket.id).catch((error) => console.error("ludo leave failed:", error));
  });

  socket.on(
    "ludo:ready",
    guarded(async (gameId, payload) => service.setReady({ _id: socket.userId }, gameId, payload.ready, io)),
  );
  socket.on(
    "ludo:start",
    guarded(async (gameId) => service.startLobby({ _id: socket.userId }, gameId, io)),
  );
  socket.on(
    "ludo:roll",
    guarded(async (gameId, payload) => service.rollDice(io, socket.userId, gameId, { expectedVersion: payload.expectedVersion, actionId: payload.actionId }), { control: true }),
  );
  socket.on(
    "ludo:move",
    guarded(async (gameId, payload) => service.selectToken(io, socket.userId, gameId, { tokenId: payload.tokenId, expectedVersion: payload.expectedVersion, actionId: payload.actionId }), { control: true }),
  );

  socket.on("ludo:chat", async (payload, ack) => {
    try {
      await assertUserCan(socket.userId, ACTIONS.SEND_MESSAGE);
      const { room, payload: relayed } = await service.prepareChat(socket.userId, text(payload?.gameId), payload?.text);
      // Everyone in the room, the sender included (their message is shown from the server's copy).
      io.to(room).emit("ludo:chat", relayed);
      reply(ack, { ok: true });
    } catch (error) {
      reply(ack, toError(error));
    }
  });

  socket.on("ludo:reaction", async (payload, ack) => {
    try {
      await assertUserCan(socket.userId, ACTIONS.GAME_PLAY);
      const { room, payload: relayed } = await service.prepareReaction(socket.userId, text(payload?.gameId), payload?.type);
      io.to(room).emit("ludo:reaction", relayed);
      reply(ack, { ok: true });
    } catch (error) {
      reply(ack, toError(error));
    }
  });

  // A dropped connection: if it was the player's last one in a live game they are
  // marked away and the server's reconnect window starts.
  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (!room.startsWith("ludo:")) continue;
      service.handleRoomLeft(io, socket.userId, room.slice("ludo:".length), socket.id).catch((error) => console.error("ludo disconnect failed:", error));
    }
  });
}

module.exports = { registerLudoSocket };
