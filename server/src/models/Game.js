const mongoose = require("mongoose");

// The catalog entry for one playable game type. Behaviour (generator,
// scoring rule) lives in code — services/games/gameTypes.js — because it
// can't be stored as data; this document holds the parts an admin may
// reasonably tune later (display name, question count, active switch). Rows
// are created from the registry on first use (see game.service.js), and
// after that the stored name/description/questionCount/active are never
// overwritten by a restart.
const gameSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, unique: true, trim: true },
    category: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    icon: { type: String, default: "" },
    questionCount: { type: Number, required: true, min: 1, max: 50 },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Game", gameSchema);
