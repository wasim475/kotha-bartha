const mongoose = require("mongoose");

// One page view: the analytics foundation. Deliberately minimal: who (a user id
// when signed in, always an anonymous session id), which PAGE (a normalized key
// such as "feed" or "study/quiz", ids stripped) and when. Nothing from message
// bodies, forms or query strings is ever recorded.
const pageViewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    sessionId: { type: String, required: true, maxlength: 64 },
    page: { type: String, required: true, maxlength: 60 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

// Date-range aggregations (active users, page views, top pages).
pageViewSchema.index({ createdAt: -1 });
pageViewSchema.index({ userId: 1, createdAt: -1 });
pageViewSchema.index({ page: 1, createdAt: -1 });

module.exports = mongoose.model("PageView", pageViewSchema);
