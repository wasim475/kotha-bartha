const mongoose = require("mongoose");

const optionSchema = new mongoose.Schema({ text: String, correct: Boolean }, { _id: false });
const questionSnapshotSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  type: { type: String, enum: ["mcq", "short_answer", "sentence"], required: true },
  prompt: { type: String, required: true },
  options: { type: [optionSchema], default: [] },
  acceptedAnswers: { type: [String], default: [] },
  explanation: { type: String, default: "" },
}, { _id: false });
const feedbackSchema = new mongoose.Schema({
  questionId: mongoose.Schema.Types.ObjectId,
  correct: Boolean,
  submittedAnswer: mongoose.Schema.Types.Mixed,
  expectedAnswers: [String],
}, { _id: false });
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseLesson", required: true, index: true },
  questions: { type: [questionSnapshotSchema], required: true, validate: (value) => value.length === 3 },
  status: { type: String, enum: ["in_progress", "completed", "expired"], default: "in_progress", index: true },
  score: { type: Number, min: 0, max: 3 },
  passed: { type: Boolean },
  feedback: { type: [feedbackSchema], default: [] },
  submittedAt: Date,
}, { timestamps: true });
schema.index({ userId: 1, lessonId: 1, createdAt: -1 });
module.exports = mongoose.model("CourseLessonAttempt", schema);
