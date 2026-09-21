const mongoose = require("mongoose");
const { REACTION_TYPES } = require("../utils/reactionTypes");

const reactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetType: { type: String, enum: ["post", "comment"], required: true },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: REACTION_TYPES,
      default: "like",
    },
  },
  { timestamps: true },
);
reactionSchema.index(
  { userId: 1, targetType: 1, targetId: 1 },
  { unique: true },
);
module.exports = mongoose.model("Reaction", reactionSchema);
