const mongoose = require("mongoose");

const CLASS_LEVELS = ["5th", "6th", "7th", "8th", "9th", "10th"];

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    classLevel: { type: String, required: true, enum: CLASS_LEVELS },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

// One subject name per class — "Science" for 8th and "Science" for 9th
// are two different documents, but you can't create "Science" twice
// under 8th.
subjectSchema.index({ classLevel: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Subject", subjectSchema);
module.exports.CLASS_LEVELS = CLASS_LEVELS;
