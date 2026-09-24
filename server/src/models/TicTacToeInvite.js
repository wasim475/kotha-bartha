const mongoose = require("mongoose");

// A pending request between two friends — either a first invitation to play
// (`kind: "invite"`) or a "play again" request after a finished game
// (`kind: "rematch"`). Same states and expiry either way.
const ticTacToeInviteSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["invite", "rematch"], default: "invite" },
    gameType: { type: String, default: "tic-tac-toe" },
    inviterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    inviteeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    pairKey: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "expired", "cancelled"],
      default: "pending",
    },
    expiresAt: { type: Date, required: true },
    respondedAt: { type: Date, default: null },
    // The game created when this was accepted.
    gameId: { type: mongoose.Schema.Types.ObjectId, ref: "TicTacToeGame", default: null },
    // For a rematch: the finished game being replayed.
    previousGameId: { type: mongoose.Schema.Types.ObjectId, ref: "TicTacToeGame", default: null },
  },
  { timestamps: true },
);

// At most ONE pending request of each kind per pair of users (in either
// direction) — the database, not the client, prevents duplicates.
ticTacToeInviteSchema.index(
  { pairKey: 1, gameType: 1, kind: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);
ticTacToeInviteSchema.index({ inviteeId: 1, status: 1, expiresAt: 1 });
ticTacToeInviteSchema.index({ inviterId: 1, status: 1, expiresAt: 1 });
ticTacToeInviteSchema.index({ previousGameId: 1, createdAt: -1 });

module.exports = mongoose.model("TicTacToeInvite", ticTacToeInviteSchema);
