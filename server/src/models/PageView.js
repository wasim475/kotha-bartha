const mongoose = require("mongoose");

// One page view: the analytics foundation. Deliberately minimal: who (a user id
// when signed in, always an anonymous session id), which PAGE (a normalized key
// such as "feed" or "study/quiz", ids stripped) and when. Nothing from message
// bodies, forms or query strings is ever recorded.
//
// Engagement extends the same record. A view that the browser tracks carries a
// random `viewId`; heartbeats and the final exit update THAT document, so a page
// visit is exactly one row however long it lasts. `durationSeconds` is ACTIVE time
// (tab visible, user not idle), decided by the client but validated and capped by
// the server. Older rows simply have none of the engagement fields.
const pageViewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    sessionId: { type: String, required: true, maxlength: 64 },
    page: { type: String, required: true, maxlength: 60 },
    createdAt: { type: Date, default: Date.now },

    viewId: { type: String, maxlength: 64 },
    enteredAt: { type: Date },
    lastActivityAt: { type: Date },
    exitedAt: { type: Date },
    durationSeconds: { type: Number, min: 0 },
    device: { type: String, enum: ["mobile", "tablet", "desktop"] },
  },
  { versionKey: false },
);

// Date-range aggregations (active users, page views, top pages).
pageViewSchema.index({ createdAt: -1 });
pageViewSchema.index({ userId: 1, createdAt: -1 });
pageViewSchema.index({ page: 1, createdAt: -1 });
// One document per tracked visit. Partial, so older rows (no viewId) are not indexed.
pageViewSchema.index({ viewId: 1 }, { unique: true, partialFilterExpression: { viewId: { $type: "string" } } });

module.exports = mongoose.model("PageView", pageViewSchema);
