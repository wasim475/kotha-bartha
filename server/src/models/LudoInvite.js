const mongoose = require("mongoose");

// An invitation to join a Ludo lobby — a first invitation from the host
// (`kind: "invite"`) or a "play again" request after a finished match
// (`kind: "rematch"`, into a new rematch lobby). Same states and expiry either
// way, mirroring the Tic-Tac-Toe / challenge invites.
const ludoInviteSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["invite", "rematch"], default: "invite" },
    gameId: { type: mongoose.Schema.Types.ObjectId, ref: "LudoGame", required: true },
    variantId: { type: String, required: true },
    inviterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    inviteeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted", "declined", "expired", "cancelled"], default: "pending" },
    expiresAt: { type: Date, required: true },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// At most ONE pending invitation per lobby and person — the database, not the client, prevents duplicates.
ludoInviteSchema.index({ gameId: 1, inviteeId: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });
ludoInviteSchema.index({ inviteeId: 1, status: 1, expiresAt: 1 });
ludoInviteSchema.index({ inviterId: 1, status: 1, expiresAt: 1 });

module.exports = mongoose.model("LudoInvite", ludoInviteSchema);
