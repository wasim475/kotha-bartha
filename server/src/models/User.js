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
    // Quiz management (server/src/routes/quiz.routes.js) is the only
    // feature gated by this today — "admin"/"moderator" can create
    // subjects/chapters/questions, everyone else can only play quizzes.
    // There's no UI to change this yet (out of scope for the quiz
    // system itself); set it directly in the database for now.
    role: { type: String, enum: ["user", "moderator", "admin"], default: "user" },
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
    // Legacy E2E encryption public key (JWK JSON string) — pre-multi-device,
    // a single key per account regardless of how many browsers/devices used
    // it. Superseded by `publicKeys` below; kept (never deleted) so old
    // messages encrypted under it stay decryptable on whichever device
    // originally generated it — see getPublicKeys() and
    // client/src/utility/crypto.js's LEGACY_DEVICE_ID.
    publicKey: { type: String, default: null },
    // One ECDH public key per device that's ever published one for this
    // account, keyed by that device's stable, self-assigned `deviceId` (see
    // client/src/utility/crypto.js). Each device's matching private key
    // never leaves its own browser. Upserted by deviceId only — see
    // PATCH /users/me/public-key — so one device publishing never
    // overwrites another's entry.
    publicKeys: {
      type: [
        {
          _id: false,
          deviceId: { type: String, required: true },
          jwk: { type: String, required: true },
          updatedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

// Identifies the synthesized entry getPublicKeys() adds for a pre-existing
// `publicKey` value — must match client/src/utility/crypto.js's exported
// LEGACY_DEVICE_ID exactly, since the client uses this id to know which of
// a peer's keys was used to encrypt old-format messages.
const LEGACY_DEVICE_ID = "legacy";

// The full, effective list of this account's public keys for encrypting
// to it — every device that's registered one via the multi-device flow,
// plus (if present) the old single `publicKey` field surfaced as a
// synthetic "legacy" device entry, so callers never need to look at both
// fields separately and old conversations keep working.
userSchema.methods.getPublicKeys = function getPublicKeys() {
  const keys = (this.publicKeys || []).map((entry) => ({
    deviceId: entry.deviceId,
    jwk: entry.jwk,
  }));
  if (this.publicKey && !keys.some((key) => key.deviceId === LEGACY_DEVICE_ID)) {
    keys.push({ deviceId: LEGACY_DEVICE_ID, jwk: this.publicKey });
  }
  return keys;
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    fullName: this.fullName,
    email: this.email,
    role: this.role,
    bio: this.bio,
    dateOfBirth: this.dateOfBirth,
    hometown: this.hometown,
    currentCity: this.currentCity,
    avatar: this.avatar,
    cover: this.cover,
    settings: this.settings,
    lastSeenAt: this.lastSeenAt,
    // Kept for any lingering consumer of the old single-key shape.
    publicKey: this.publicKey,
    publicKeys: this.getPublicKeys(),
  };
};

module.exports = mongoose.model("User", userSchema);
module.exports.LEGACY_DEVICE_ID = LEGACY_DEVICE_ID;
