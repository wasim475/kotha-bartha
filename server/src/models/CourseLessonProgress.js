const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseLesson", required: true },
  lastReadAt: { type: Date, default: null },
  lastAttemptAt: { type: Date, default: null },
  passedAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ userId: 1, lessonId: 1 }, { unique: true });
module.exports = mongoose.model("CourseLessonProgress", schema);
