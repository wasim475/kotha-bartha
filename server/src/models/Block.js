const mongoose = require("mongoose");

// Directional: `blockerId` blocked `blockedId`. Block is not symmetric data
// (only one side chose it), but its *effect* (no friend requests, no
// messaging) is enforced as mutual by checking both directions wherever a
// block is consulted — see utils/blocks.js.
const blockSchema = new mongoose.Schema(
  {
    blockerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    blockedId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

blockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

module.exports = mongoose.model("Block", blockSchema);
