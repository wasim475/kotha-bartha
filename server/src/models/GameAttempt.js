const mongoose = require("mongoose");

// One play-through of one game (the persisted "game session"). The server
// generates the questions once at start and stores them here, including
// the correct answer — which is never sent to the client until that
// question has been answered (see serializeAttempt in game.service.js).
// Score/correct/wrong/status are only ever changed by the answer endpoint.
//
// Leaderboard: a COMPLETED attempt's `score` counts toward the Games
// leaderboard every time (unlike Quiz, which counts only a first attempt).
// The Leaderboard reads completed attempts directly (see
// leaderboardRanking.service.js), so an attempt is exactly one row and can
// never be counted twice; an unfinished/abandoned attempt has status
// "playing" and is never counted.
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
        // null when the question timed out (nothing was chosen in time).
        selectedPosition: { type: Number, default: null },
        correct: Boolean,
        timedOut: { type: Boolean, default: false },
        pointsAwarded: Number,
        answeredAt: { type: Date, default: Date.now },
      },
    ],
    // Per-question time limit, snapshotted from the registry at start so a
    // later change to a game's rules never alters an attempt already in
    // flight. null = untimed.
    timeLimitMs: { type: Number, default: null },
    // Server-authoritative clock for the CURRENT question (timed games
    // only): when its window opens. The answer endpoint measures every
    // answer/timeout against this — never against anything the client says.
    questionStartedAt: { type: Date, default: null },
    currentIndex: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    // Includes timeouts (a timeout is a wrong answer).
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
// "Last completed game" lookups and Leaderboard aggregation over completed
// attempts within a date window.
gameAttemptSchema.index({ userId: 1, status: 1, completedAt: -1 });
gameAttemptSchema.index({ status: 1, completedAt: -1 });

module.exports = mongoose.model("GameAttempt", gameAttemptSchema);
