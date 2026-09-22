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
    passwordHash: { 
      type: String, 
      required: function () {
        // শুধু normal (non-Google) signup হলেই পাসওয়ার্ড বাধ্যতামূলক
        return !this.googleId;
      }, 
      select: false
     },
      googleId: {
      type: String,
      unique: true,
      sparse: true, // যাদের googleId নেই, তাদের জন্য unique constraint স্কিপ হবে
      index: true,
    },
    bio: { type: String, trim: true, maxlength: 240, default: "" },
    dateOfBirth: { type: Date, default: null },
    hometown: { type: String, trim: true, maxlength: 80, default: "" },
    currentCity: { type: String, trim: true, maxlength: 80, default: "" },
    avatar: { publicId: String, secureUrl: String },
    cover: { publicId: String, secureUrl: String },
    settings: {
      theme: { type: String, enum: ["light", "dark"], default: "light" },
      rememberLogin: { type: Boolean, default: true },
    },
    lastSeenAt: Date,
    // E2E encryption public key (JWK JSON string) for this device's most
    // recently generated ECDH keypair — see client/src/utility/crypto.js.
    // The matching private key never leaves the browser.
    publicKey: { type: String, default: null },
  },
  { timestamps: true },
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    fullName: this.fullName,
    email: this.email,
    bio: this.bio,
    dateOfBirth: this.dateOfBirth,
    hometown: this.hometown,
    currentCity: this.currentCity,
    avatar: this.avatar,
    cover: this.cover,
    settings: this.settings,
    lastSeenAt: this.lastSeenAt,
    publicKey: this.publicKey,
  };
};

module.exports = mongoose.model("User", userSchema);
