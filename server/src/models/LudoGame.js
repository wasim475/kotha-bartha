const mongoose = require("mongoose");

// One Ludo game, from lobby to result. The same document is the lobby while
// `status` is "lobby" (a roster of members and their ready flags) and the match
// once it is "active". The server is the ONLY writer of `state`: every change
// is the engine's output for a validated action, stored with a conditional
// update on `stateVersion` (see ludo.service.js), so two simultaneous actions
// can never both apply.
//
// `state` is the engine's full state, including the dice generator, so it is
// PRIVATE — it is never sent to a client as is (ludo.service.js serializes it
// through the engine's publicState). The other top-level fields mirror the parts
// of it that need indexing or that a history / leaderboard query reads.
//
// Rewards: `rankings[].rewardPoints/rewardXp` are written in the SAME atomic
// update that moves the game from "active" to "finished" — a transition that can
// only happen once — so a game can be rewarded exactly once however many
// requests / sockets / restarts are involved. The Games leaderboard and the
// per-player statistics are computed from finished games only.
const rankingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    seat: { type: Number, required: true },
    rank: { type: Number, required: true },
    // WIN | LOSS | FINISHED | FORFEIT | DRAW
    result: { type: String, required: true },
    captures: { type: Number, default: 0 },
    tokensHome: { type: Number, default: 0 },
    rewardPoints: { type: Number, default: 0 },
    rewardXp: { type: Number, default: 0 },
    rewardCoins: { type: Number, default: 0 },
  },
  { _id: false },
);

const memberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ready: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ludoGameSchema = new mongoose.Schema(
  {
    gameType: { type: String, default: "ludo" },
    variantId: { type: String, required: true },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["lobby", "active", "finished", "cancelled"], default: "lobby" },

    // ---- Lobby
    settings: {
      minPlayers: { type: Number, required: true },
      maxPlayers: { type: Number, required: true },
      // Start as soon as the minimum number of players has joined.
      autoStart: { type: Boolean, default: false },
    },
    members: { type: [memberSchema], default: [] },
    // A rematch lobby starts by itself once this many players have joined.
    expectedPlayers: { type: Number, default: null },
    rematchOf: { type: mongoose.Schema.Types.ObjectId, ref: "LudoGame", default: null },

    // ---- Match (set when the lobby starts)
    participantIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    state: { type: mongoose.Schema.Types.Mixed, default: null },
    stateVersion: { type: Number, default: 0 },
    currentTurn: { type: Number, default: null }, // the seat to act
    turnStartedAt: { type: Date, default: null },
    turnDeadline: { type: Date, default: null },
    // The earliest moment the server must act (the turn running out, or a
    // disconnected player's reconnect window ending); what the sweeper looks at.
    nextDeadlineAt: { type: Date, default: null },
    diceResult: { type: Number, default: null },
    moveCount: { type: Number, default: 0 },
    captures: { type: [mongoose.Schema.Types.Mixed], default: [] },

    // ---- Result
    winnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rankings: { type: [rankingSchema], default: [] },
    finishReason: { type: String, default: null },
    rewardsGranted: { type: Boolean, default: false },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    durationSec: { type: Number, default: null },
  },
  { timestamps: true, minimize: false },
);

// A user's games (active ones, history).
ludoGameSchema.index({ participantIds: 1, status: 1, finishedAt: -1 });
ludoGameSchema.index({ "members.userId": 1, status: 1 });
// The deadline sweeper: active games whose turn (or reconnect window) may have run out.
ludoGameSchema.index({ status: 1, nextDeadlineAt: 1 });
// Leaderboard: reward rows of finished games in a time window.
ludoGameSchema.index({ status: 1, finishedAt: -1, rewardsGranted: 1 });
ludoGameSchema.index({ rematchOf: 1 });

module.exports = mongoose.model("LudoGame", ludoGameSchema);
