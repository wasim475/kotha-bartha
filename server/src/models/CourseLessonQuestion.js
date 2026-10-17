const mongoose = require("mongoose");

const optionSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true, maxlength: 500 },
  correct: { type: Boolean, default: false },
}, { _id: false });

const schema = new mongoose.Schema({
  lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseLesson", required: true, index: true },
  type: { type: String, enum: ["mcq", "short_answer", "sentence"], required: true },
  prompt: { type: String, required: true, trim: true, maxlength: 1000 },
  options: { type: [optionSchema], default: [] },
  acceptedAnswers: { type: [String], default: [] },
  explanation: { type: String, trim: true, maxlength: 1000, default: "" },
  order: { type: Number, default: 0, min: 0, max: 10000 },
}, { timestamps: true });
schema.index({ lessonId: 1, order: 1 });
module.exports = mongoose.model("CourseLessonQuestion", schema);
