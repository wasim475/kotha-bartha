const mongoose = require("mongoose");

// A single 1-to-1 call session. The server is the only writer of `status`;
// the client only ever asks for a transition (accept/decline/end/...) and is
// told whether it was allowed. `connecting`/`connected`/`reconnecting` are
// best-effort, client-reported phases of an already-accepted call (the
// server has no visibility into the actual WebRTC/ICE connection) — every
// other status change is fully server-authoritative.
const callSchema = new mongoose.Schema(
  {
    callerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    calleeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    // Whether this started as a video call or an audio-only one. Either
    // side can still turn their camera on/off during the call — this just
    // records how it began, for the call-log icon/label.
    video: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["ringing", "accepted", "connecting", "connected", "reconnecting", "ended", "declined", "missed", "cancelled", "failed"],
      default: "ringing",
      index: true,
    },
    acceptedAt: Date,
    connectedAt: Date,
    endedAt: Date,
    durationSec: { type: Number, default: 0 },
    endedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    screenShare: {
      active: { type: Boolean, default: false },
      byUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },
  },
  { timestamps: true },
);

callSchema.index({ callerId: 1, createdAt: -1 });
callSchema.index({ calleeId: 1, createdAt: -1 });
callSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model("Call", callSchema);
