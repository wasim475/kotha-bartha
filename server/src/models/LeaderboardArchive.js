const mongoose = require("mongoose");

// One finalized monthly Leaderboard, frozen at creation time. `entries`
// snapshots every eligible participant's profile fields and points as they
// existed at finalization — never re-joined against the live User/
// QuizAttempt collections — so a later profile-picture/name/city change,
// a new quiz score, an unfriend, or even a block can never alter a month
// that's already been archived. `userId` is kept purely as a reference for
// convenience (e.g. linking to a still-existing profile); nothing here
// depends on it still resolving to a real document.
const leaderboardArchiveEntrySchema = new mongoose.Schema(
  {
    rank: { type: Number, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    fullName: { type: String, required: true },
    avatar: { publicId: String, secureUrl: String },
    currentCity: { type: String, default: "" },
    points: { type: Number, required: true },
    quizPoints: { type: Number, required: true },
    // No Games data source exists yet (see leaderboard.routes.js) — kept
    // here, defaulted to 0, so a future Games source doesn't need a schema
    // migration to slot in.
    gamesPoints: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    wrongCount: { type: Number, default: 0 },
    attempted: { type: Number, default: 0 },
  },
  { _id: false },
);

const leaderboardArchiveSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    totalParticipants: { type: Number, required: true },
    entries: [leaderboardArchiveEntrySchema],
  },
  { timestamps: true },
);

// One archive per calendar month, ever — this is what makes duplicate
// archive creation impossible even if the reconciliation job runs twice
// concurrently (see services/leaderboardArchive.service.js): the second
// create() simply fails with a duplicate-key error, which is caught and
// ignored there.
leaderboardArchiveSchema.index({ year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("LeaderboardArchive", leaderboardArchiveSchema);
