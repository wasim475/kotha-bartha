const mongoose = require("mongoose");
const { CELL_COUNT } = require("../services/ticTacToe/logic");

// One Tic-Tac-Toe game between two friends. The server is the only writer of
// the board: a move changes exactly one cell through a conditional update (see
// ticTacToe.service.js makeMove), never a client-supplied board.
//
// Reward: `rewardPoints` (the win reward, else 0) is set in the SAME atomic
// update that moves the game from "active" to "won" — a transition that can
// only happen once — and the Games leaderboard reads it from won games (see
// leaderboardRanking.service.js). So a win can be rewarded exactly once,
// however many requests / socket events / refreshes arrive.
const ticTacToeGameSchema = new mongoose.Schema(
  {
    gameType: { type: String, default: "tic-tac-toe" },
    playerX: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    playerO: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Order-independent key of the two players, for "is there already an
    // active game between these two" lookups.
    pairKey: { type: String, required: true },
    board: {
      type: [mongoose.Schema.Types.Mixed],
      default: () => Array(CELL_COUNT).fill(null),
      validate: { validator: (board) => board.length === CELL_COUNT, message: "Board must have 9 cells." },
    },
    currentTurn: { type: String, enum: ["X", "O"], default: "X" },
    // "waiting" is part of the state model but unused by the friend flow, where
    // both players are known when the game is created.
    status: { type: String, enum: ["waiting", "active", "won", "draw", "abandoned"], default: "active" },
    winner: { type: String, enum: ["X", "O", null], default: null },
    winnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    winningLine: { type: [Number], default: [] },
    moveCount: { type: Number, default: 0 },
    rewardPoints: { type: Number, default: 0 },
    abandonedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // The invitation / rematch request that created this game — unique, so
    // accepting the same request twice can never create two games.
    invitationId: { type: mongoose.Schema.Types.ObjectId, ref: "TicTacToeInvite" },
    rematchOf: { type: mongoose.Schema.Types.ObjectId, ref: "TicTacToeGame", default: null },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ticTacToeGameSchema.index({ invitationId: 1 }, { unique: true, partialFilterExpression: { invitationId: { $type: "objectId" } } });
ticTacToeGameSchema.index({ playerX: 1, status: 1 });
ticTacToeGameSchema.index({ playerO: 1, status: 1 });
ticTacToeGameSchema.index({ pairKey: 1, status: 1 });
// Leaderboard: a user's won games in a time window.
ticTacToeGameSchema.index({ winnerId: 1, status: 1, finishedAt: -1 });

module.exports = mongoose.model("TicTacToeGame", ticTacToeGameSchema);
