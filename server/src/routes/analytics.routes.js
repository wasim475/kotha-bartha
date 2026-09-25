const express = require("express");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { recordPageView } = require("../services/analytics.service");
const { respond } = require("../utils/gameRespond");

// Page-view tracking. Public on purpose (visitors who are not signed in count too),
// so it is mounted BEFORE the global rate limiter in app.js and carries its own,
// and it never lets page tracking use up the budget of real actions.
//
// Body: { sessionId, path }. If a valid session cookie is present the view is
// attributed to that user; the client never says who it is.
const router = express.Router();

router.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

const optionalUserId = (req) => {
  try {
    const token = req.cookies?.kotha_token || req.headers.authorization?.replace("Bearer ", "");
    return token ? jwt.verify(token, process.env.JWT_SECRET).sub : null;
  } catch {
    return null;
  }
};

router.post(
  "/pageview",
  respond(async (req) => ({
    data: await recordPageView({ userId: optionalUserId(req), sessionId: req.body?.sessionId, path: req.body?.path }),
  })),
);

module.exports = router;
