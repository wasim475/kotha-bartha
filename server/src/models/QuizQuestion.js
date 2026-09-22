const mongoose = require("mongoose");

// A quiz "Set" is not its own collection — it's purely derived from how
// many questions exist for a chapter (see quiz.routes.js's
// chapterQuestionSummary). Questions 0-29 (by slotIndex) are Set 1,
// 30-59 are Set 2, and so on; a set is only playable once it has all 30.
const QUESTIONS_PER_SET = 30;

const quizQuestionSchema = new mongoose.Schema(
  {
    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chapter",
      required: true,
      index: true,
    },
    // Denormalized from the chapter, for filtering/display without a
    // populate on hot read paths (listing sets, starting an attempt).
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    // Unset for general_knowledge/sports questions — only "class" category
    // chapters carry a classLevel.
    classLevel: { type: String },
    question: { type: String, required: true, trim: true, maxlength: 1000 },
    options: {
      type: [{ type: String, trim: true, maxlength: 300 }],
      validate: {
        validator: (value) => Array.isArray(value) && value.length === 4,
        message: "A question needs exactly 4 options.",
      },
    },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    // This question's position within its chapter, 0-based, assigned once
    // at creation from the chapter's question count at that moment and
    // never recalculated — what makes set numbering stable regardless of
    // when/by whom later questions are added.
    slotIndex: { type: Number, required: true },
    setNumber: { type: Number, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

quizQuestionSchema.index({ chapterId: 1, setNumber: 1 });
// Guards against two concurrent "add question" requests both computing
// the same slotIndex from a stale count and silently overwriting each
// other's numbering — the second one's create() fails fast instead.
quizQuestionSchema.index({ chapterId: 1, slotIndex: 1 }, { unique: true });

module.exports = mongoose.model("QuizQuestion", quizQuestionSchema);
module.exports.QUESTIONS_PER_SET = QUESTIONS_PER_SET;
