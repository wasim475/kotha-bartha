const mongoose = require("mongoose");

// One English Game question. THE source of truth for what the English games
// ask — admins/moderators add unlimited questions through the management
// screen, and the games draw from here (see englishQuestion.service.js). The
// hardcoded englishBanks.js is only the default seed that is copied in once.
//
// `correctIndex` is admin-facing data and is never sent to players: at play
// time a question is snapshotted into the GameAttempt with its options
// freshly shuffled per attempt, and the correct answer is revealed only
// after that question has been answered (game.service.js).
const QUESTION_TYPES = {
  word_meaning: { label: "Word Meaning", gameType: "english-word" },
  synonym: { label: "Synonym", gameType: "english-word" },
  antonym: { label: "Antonym", gameType: "english-word" },
  vocabulary: { label: "Basic Vocabulary", gameType: "english-word" },
  conversion: { label: "Sentence Conversion", gameType: "english-conversion" },
};

const englishQuestionSchema = new mongoose.Schema(
  {
    // Which English game this question belongs to — derived from
    // `questionType` (see QUESTION_TYPES), stored so selection can filter on
    // it directly with an index.
    gameType: { type: String, enum: ["english-word", "english-conversion"], required: true },
    questionType: { type: String, enum: Object.keys(QUESTION_TYPES), required: true },
    question: { type: String, required: true, trim: true, maxlength: 500 },
    // Lower-cased, whitespace-collapsed `question` — the identity used to
    // reject a duplicate question within a game.
    promptKey: { type: String, required: true },
    options: {
      type: [String],
      validate: {
        validator: (options) => Array.isArray(options) && options.length === 4,
        message: "Exactly 4 options are required.",
      },
    },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    // Disabling (never deleting) takes a question out of play without losing
    // it, and without disturbing any attempt that already used it.
    active: { type: Boolean, default: true },
    // Set only on questions copied in from the hardcoded seed, and never
    // changed by edits — it is how re-seeding recognises a seeded question
    // even after an admin has reworded it, so it can't be resurrected.
    seedKey: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// No duplicate question text within one game.
englishQuestionSchema.index({ gameType: 1, promptKey: 1 }, { unique: true });
// The play-time selection filter: active questions of one game.
englishQuestionSchema.index({ gameType: 1, active: 1 });
// Admin list: newest first, optionally narrowed by type.
englishQuestionSchema.index({ questionType: 1, createdAt: -1 });
englishQuestionSchema.index({ createdAt: -1 });
englishQuestionSchema.index(
  { seedKey: 1 },
  { unique: true, partialFilterExpression: { seedKey: { $type: "string" } } },
);

const EnglishQuestion = mongoose.model("EnglishQuestion", englishQuestionSchema);
EnglishQuestion.QUESTION_TYPES = QUESTION_TYPES;

module.exports = EnglishQuestion;
