const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 500, default: "" },
  order: { type: Number, default: 0, min: 0, max: 10000 },
  visible: { type: Boolean, default: true },
}, { timestamps: true });
schema.index({ courseId: 1, visible: 1, order: 1 });
module.exports = mongoose.model("CourseSection", schema);
