const mongoose = require("mongoose");

const quizAttemptSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter", required: true, index: true },
    setNumber: { type: Number, required: true },
    status: { type: String, enum: ["in_progress", "completed"], default: "in_progress" },
    // True only for the one attempt (per user+chapter+set) whose score
    // counts toward the leaderboard — decided once, at creation, and
    // enforced by the partial unique index below so it can never end up
    // true on two attempts for the same set even under a race.
    isFirstAttempt: { type: Boolean, default: false },
    // The randomized question order and, in parallel, each question's
    // randomized option order — both generated once when the attempt
    // starts and persisted, so resuming (or a page refresh mid-quiz)
    // shows the exact same order instead of re-shuffling underneath the
    // user. `optionOrders[i]` is a permutation of [0,1,2,3]: position `p`
    // in the shuffled options the client sees maps to
    // `QuizQuestion.options[optionOrders[i][p]]`.
    questionOrder: [{ type: mongoose.Schema.Types.ObjectId, ref: "QuizQuestion" }],
    optionOrders: [[Number]],
    answers: [
      {
        _id: false,
        questionId: { type: mongoose.Schema.Types.ObjectId, ref: "QuizQuestion" },
        selectedPosition: Number,
        correct: Boolean,
        answeredAt: { type: Date, default: Date.now },
      },
    ],
    currentIndex: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    wrongCount: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
  },
  { timestamps: true },
);

// At most one in-progress attempt per user+chapter+set — "start" resumes
// this one instead of creating a duplicate when the user comes back.
quizAttemptSchema.index(
  { userId: 1, chapterId: 1, setNumber: 1 },
  { unique: true, partialFilterExpression: { status: "in_progress" } },
);
// At most one attempt per user+chapter+set may ever carry
// isFirstAttempt — the one whose score is permanently on the leaderboard.
quizAttemptSchema.index(
  { userId: 1, chapterId: 1, setNumber: 1 },
  { unique: true, partialFilterExpression: { isFirstAttempt: true } },
);

module.exports = mongoose.model("QuizAttempt", quizAttemptSchema);
