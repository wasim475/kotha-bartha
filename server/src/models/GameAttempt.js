const mongoose = require("mongoose");

// One play-through of one game (the persisted "game session"). The server
// generates the questions once at start and stores them here, including
// the correct answer — which is never sent to the client until that
// question has been answered (see serializeAttempt in game.service.js).
// Score/correct/wrong/status are only ever changed by the answer endpoint.
//
// Leaderboard compatibility: `userId` + `gameType`/`category` + `score` +
// `completedAt` on a completed attempt is everything an Overall or Games
// leaderboard needs to aggregate from — the existing leaderboard code can
// read completed attempts later without any change to this shape.
const gameAttemptSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    gameId: { type: mongoose.Schema.Types.ObjectId, ref: "Game" },
    gameType: { type: String, required: true, index: true },
    category: { type: String, required: true },
    questions: [
      {
        _id: false,
        prompt: { type: String, required: true },
        // Already shuffled; `correctIndex` is a position in this array.
        options: { type: [String], required: true },
        correctIndex: { type: Number, required: true },
      },
    ],
    answers: [
      {
        _id: false,
        questionIndex: Number,
        selectedPosition: Number,
        correct: Boolean,
        pointsAwarded: Number,
        answeredAt: { type: Date, default: Date.now },
      },
    ],
    currentIndex: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    wrongCount: { type: Number, default: 0 },
    status: { type: String, enum: ["playing", "completed"], default: "playing" },
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
  },
  { timestamps: true },
);

// At most one in-progress attempt per user + game — "start" resumes it
// (a page refresh mid-game keeps the same questions) instead of creating a
// duplicate. A finished attempt frees the slot, so Play Again starts fresh.
gameAttemptSchema.index(
  { userId: 1, gameType: 1 },
  { unique: true, partialFilterExpression: { status: "playing" } },
);

module.exports = mongoose.model("GameAttempt", gameAttemptSchema);
