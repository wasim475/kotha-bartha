const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    body: { type: String, trim: true, maxlength: 5000, required: true },
    media: { publicId: String, secureUrl: String, type: String },
    deletedAt: Date,
  }, 
  { timestamps: true },
);

module.exports = mongoose.model("Post", postSchema);
