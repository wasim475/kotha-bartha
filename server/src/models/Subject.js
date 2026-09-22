const mongoose = require("mongoose");

// SSC replaces separate 9th/10th classes as the final academic class.
const CLASS_LEVELS = ["5th", "6th", "7th", "8th", "SSC"];
// SSC is the only class level that branches into a division first.
const SSC_DIVISIONS = ["সাধারণ", "বিজ্ঞান", "মানবিক", "ব্যবসায় শিক্ষা"];
// The three top-level sections inside the Quiz tab. "class" is the
// existing Class -> Subject -> Chapter -> Set academic flow; the other two
// skip class/division entirely and go straight to Subject -> Chapter -> Set.
const QUIZ_CATEGORIES = ["class", "general_knowledge", "sports"];

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    category: { type: String, required: true, enum: QUIZ_CATEGORIES, default: "class" },
    // Required only for category "class"; left unset for
    // general_knowledge/sports subjects.
    classLevel: {
      type: String,
      enum: CLASS_LEVELS,
      required() {
        return this.category === "class";
      },
    },
    // Required only when category is "class" and classLevel is "SSC";
    // left unset for 5th-8th and for non-class categories.
    division: {
      type: String,
      enum: SSC_DIVISIONS,
      required() {
        return this.category === "class" && this.classLevel === "SSC";
      },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

// One subject name per (category, classLevel, division) bucket — e.g. only
// one "Science" under 8th, and a separate one allowed under SSC/বিজ্ঞান;
// "World Facts" under general_knowledge is independent of both.
subjectSchema.index({ category: 1, classLevel: 1, division: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Subject", subjectSchema);
module.exports.CLASS_LEVELS = CLASS_LEVELS;
module.exports.SSC_DIVISIONS = SSC_DIVISIONS;
module.exports.QUIZ_CATEGORIES = QUIZ_CATEGORIES;
