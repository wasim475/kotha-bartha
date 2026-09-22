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
    // filter/display by class without an extra populate on every read.
    classLevel: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

chapterSchema.index({ subjectId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Chapter", chapterSchema);
