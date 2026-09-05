const mongoose = require("mongoose");

const friendshipSchema = new mongoose.Schema(
  {
    userIds: { type: [mongoose.Schema.Types.ObjectId], required: true, index: true },
    pairKey: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Friendship", friendshipSchema);
