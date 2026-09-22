const mongoose = require("mongoose");

const chapterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
    // Denormalized from the subject at creation time — lets quiz routes
    // filter/display without an extra populate on every read.
    category: { type: String, required: true },
    classLevel: { type: String },
    division: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

chapterSchema.index({ subjectId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Chapter", chapterSchema);
