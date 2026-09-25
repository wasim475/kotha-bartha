const mongoose = require("mongoose");

// A pending friend challenge — either a first invitation to play a quiz game
// head-to-head (`kind: "invite"`) or a "play again" request after a finished
// match (`kind: "rematch"`). Same states and expiry either way (mirrors the
// Tic-Tac-Toe invite).
const gameChallengeInviteSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["invite", "rematch"], default: "invite" },
    gameType: { type: String, required: true },
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
    // The match created when this was accepted.
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: "GameChallengeMatch", default: null },
    // For a rematch: the finished match being replayed.
    previousMatchId: { type: mongoose.Schema.Types.ObjectId, ref: "GameChallengeMatch", default: null },
  },
  { timestamps: true },
);

// At most ONE pending request of each kind per pair of users (either direction)
// — the database, not the client, prevents duplicates.
gameChallengeInviteSchema.index(
  { pairKey: 1, kind: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);
gameChallengeInviteSchema.index({ inviteeId: 1, status: 1, expiresAt: 1 });
gameChallengeInviteSchema.index({ inviterId: 1, status: 1, expiresAt: 1 });

module.exports = mongoose.model("GameChallengeInvite", gameChallengeInviteSchema);
