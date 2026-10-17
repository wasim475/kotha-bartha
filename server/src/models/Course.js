const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseSubject", required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 1000, default: "" },
  coverUrl: { type: String, trim: true, maxlength: 1000, default: "" },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
  order: { type: Number, default: 0, min: 0, max: 10000 },
}, { timestamps: true });
schema.index({ subjectId: 1, status: 1, order: 1 });
module.exports = mongoose.model("Course", schema);
