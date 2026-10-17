const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500, default: "" },
  coverUrl: { type: String, trim: true, maxlength: 1000, default: "" },
  order: { type: Number, default: 0, min: 0, max: 10000 },
  visible: { type: Boolean, default: true },
}, { timestamps: true });
schema.index({ visible: 1, order: 1 });
module.exports = mongoose.model("CourseSubject", schema);
