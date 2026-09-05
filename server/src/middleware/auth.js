const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function requireAuth(req, res, next) {
  try {
    const token =
      req.cookies.kotha_token ||
      req.headers.authorization?.replace("Bearer ", "");
    if (!token)
      return res
        .status(401)
        .json({
          error: { code: "UNAUTHENTICATED", message: "Please log in." },
        });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user)
      return res
        .status(401)
        .json({
          error: {
            code: "UNAUTHENTICATED",
            message: "Session is no longer valid.",
          },
        });

    req.user = user;
    next();
  } catch {
    return res
      .status(401)
      .json({
        error: { code: "UNAUTHENTICATED", message: "Please log in again." },
      });
  }
}

module.exports = { requireAuth };
