const { GameError } = require("../services/games/GameError");
const service = require("../services/ticTacToe.service");

// Client -> server Tic-Tac-Toe events, registered on the EXISTING Socket.IO
// server for every authenticated socket (see server.js — no second server).
// `socket.userId` was set by the existing handshake auth (the signed
// kotha_token cookie); it is the only identity used here, never anything the
// client sends.
//
//   ticTacToe:join  { gameId }             -> ack { ok, game }
//   ticTacToe:leave { gameId }             -> stop receiving that game's events (NOT leaving the game)
//   ticTacToe:move  { gameId, cellIndex }  -> ack { ok, game } | { ok:false, error }
//
// Server -> client events (invite, accepted, declined, move, state, finished,
// rematch, player:left, …) are emitted by ticTacToe.service.js.
const reply = (ack, payload) => {
  if (typeof ack === "function") ack(payload);
};

const toError = (error) => {
  if (error instanceof GameError) return { ok: false, error: { code: error.code, message: error.message, ...error.extra } };
  console.error("tic-tac-toe socket error:", error);
  return { ok: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong." } };
};

function registerTicTacToeSocket(io, socket) {
  socket.on("ticTacToe:join", async (payload, ack) => {
    try {
      // Only the game's own two players can enter its room; anyone else (or a
      // made-up id) gets a plain "not found".
      const { game } = await service.joinGameRoom(socket.userId, payload?.gameId, socket, io);
      reply(ack, { ok: true, game });
    } catch (error) {
      reply(ack, toError(error));
    }
  });

  socket.on("ticTacToe:leave", (payload) => {
    if (typeof payload?.gameId === "string") socket.leave(service.gameRoom(payload.gameId));
  });

  socket.on("ticTacToe:move", async (payload, ack) => {
    try {
      const { game } = await service.makeMove(socket.userId, payload?.gameId, payload?.cellIndex, io);
      reply(ack, { ok: true, game });
    } catch (error) {
      reply(ack, toError(error));
    }
  });
}

module.exports = { registerTicTacToeSocket };
