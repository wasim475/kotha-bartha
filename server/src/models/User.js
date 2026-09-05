const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    bio: { type: String, trim: true, maxlength: 240, default: "" },
    avatar: { publicId: String, secureUrl: String },
    cover: { publicId: String, secureUrl: String },
    settings: {
      theme: { type: String, enum: ["light", "dark"], default: "light" },
      rememberLogin: { type: Boolean, default: true },
    },
    lastSeenAt: Date,
  },
  { timestamps: true },
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    fullName: this.fullName,
    email: this.email,
    bio: this.bio,
    avatar: this.avatar,
    cover: this.cover,
    settings: this.settings,
    lastSeenAt: this.lastSeenAt,
  };
};

module.exports = mongoose.model("User", userSchema);
