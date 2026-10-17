const mongoose = require("mongoose");

const blockSchema = new mongoose.Schema({
  type: { type: String, enum: ["text", "image", "video", "quote", "callout", "divider"], required: true },
  text: { type: String, maxlength: 20000, default: "" },
  title: { type: String, maxlength: 200, default: "" },
  url: { type: String, maxlength: 1000, default: "" },
  alt: { type: String, maxlength: 300, default: "" },
  caption: { type: String, maxlength: 500, default: "" },
  variant: { type: String, enum: ["important", "remember", "example", "warning", "tip", "default"], default: "default" },
}, { _id: false });
const schema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseSection", required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 600, default: "" },
  blocks: { type: [blockSchema], default: [] },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
  testPublished: { type: Boolean, default: false, index: true },
  order: { type: Number, default: 0, min: 0, max: 10000 },
}, { timestamps: true });
schema.index({ courseId: 1, sectionId: 1, status: 1, order: 1 });
module.exports = mongoose.model("CourseLesson", schema);
