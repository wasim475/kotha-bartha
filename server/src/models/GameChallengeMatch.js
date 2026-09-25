const mongoose = require("mongoose");

// One head-to-head quiz match between two friends (a dedicated model — never a
// GameAttempt). Everything authoritative lives here and is written only by
// services/gameChallenge.service.js:
//
//   • `questions` are the canonical set, correct answer included; a client only
//     ever gets the CURRENT question (and earlier, already-resolved ones).
//   • each player has their own `optionOrder[questionIndex]`: a permutation of
//     0..3 where position p shows canonical option `order[p]` — so both play the
//     same questions but see the options in their own random order.
//   • a question is either being answered (`phase: "question"`) or showing its
//     result (`phase: "result"`); time marks (`questionStartedAt`, `resultAt`)
//     are server clocks that decide timeouts and when to move on.
//   • when the last question resolves, status/winner/reward are set in the SAME
//     atomic update, so a match is scored (and rewarded) exactly once.
//
// Leaderboard: only a COMPLETED match with a winner carries `rewardPoints`
// (the winner's positive score); draws, losers, abandoned matches carry 0.
const answerSchema = new mongoose.Schema(
  {
    _id: false,
    questionIndex: { type: Number, required: true },
    // Position in THIS player's own option order (null = timed out).
    selectedPosition: { type: Number, default: null },
    // The canonical option index that position maps to (null = timed out).
    selectedIndex: { type: Number, default: null },
    correct: { type: Boolean, default: false },
    timedOut: { type: Boolean, default: false },
    points: { type: Number, required: true },
    answeredAt: { type: Date, default: Date.now },
  },
);

const playerSchema = new mongoose.Schema(
  {
    _id: false,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    optionOrder: { type: [[Number]], default: [] },
    answers: { type: [answerSchema], default: [] },
    score: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    wrongCount: { type: Number, default: 0 },
    timeoutCount: { type: Number, default: 0 },
  },
);

const gameChallengeMatchSchema = new mongoose.Schema(
  {
    gameType: { type: String, required: true },
    category: { type: String, required: true },
    gameName: { type: String, required: true },
    gameIcon: { type: String, default: "" },
    pairKey: { type: String, required: true },
    playerIds: { type: [mongoose.Schema.Types.ObjectId], required: true },
    players: { type: [playerSchema], required: true },
    questions: [
      {
        _id: false,
        prompt: { type: String, required: true },
        options: { type: [String], required: true },
        correctIndex: { type: Number, required: true },
      },
    ],
    questionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "EnglishQuestion" }],
    timeLimitMs: { type: Number, required: true },
    currentIndex: { type: Number, default: 0 },
    phase: { type: String, enum: ["question", "result"], default: "question" },
    questionStartedAt: { type: Date, required: true },
    resultAt: { type: Date, default: null },
    status: { type: String, enum: ["active", "completed", "abandoned"], default: "active" },
    winnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isDraw: { type: Boolean, default: false },
    rewardPoints: { type: Number, default: 0 },
    // Why a decided match paid nothing (e.g. the loser never answered anything).
    rewardWithheld: { type: String, default: null },
    abandonedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    invitationId: { type: mongoose.Schema.Types.ObjectId, ref: "GameChallengeInvite", default: null },
    rematchOf: { type: mongoose.Schema.Types.ObjectId, ref: "GameChallengeMatch", default: null },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// One match per accepted invitation, however many accepts race.
gameChallengeMatchSchema.index(
  { invitationId: 1 },
  { unique: true, partialFilterExpression: { invitationId: { $type: "objectId" } } },
);
gameChallengeMatchSchema.index({ playerIds: 1, status: 1 });
gameChallengeMatchSchema.index({ pairKey: 1, status: 1 });
// Leaderboard: winners' rewards within a date window.
gameChallengeMatchSchema.index({ winnerId: 1, status: 1, finishedAt: -1 });

module.exports = mongoose.model("GameChallengeMatch", gameChallengeMatchSchema);
