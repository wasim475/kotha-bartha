const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function issueSession(res, user) {
  const token = jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
  res.cookie("kotha_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

router.post("/register", async (req, res, next) => {
  try {
    const { fullName, email, password, confirmPassword } = req.body;
    if (!fullName || !email || !password || password !== confirmPassword) {
      return res
        .status(400)
        .json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Complete every field and make sure passwords match.",
          },
        });
    }
    if (password.length < 8)
      return res
        .status(400)
        .json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Password must be at least 8 characters.",
          },
        });
    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail }))
      return res
        .status(409)
        .json({
          error: {
            code: "EMAIL_IN_USE",
            message: "That email is already registered.",
          },
        });

    const user = await User.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
    });
    issueSession(res, user);
    return res.status(201).json({ data: user.toSafeJSON() });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({
      email: email?.trim().toLowerCase(),
    }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(password || "", user.passwordHash)))
      return res
        .status(401)
        .json({
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Email or password is incorrect.",
          },
        });
    issueSession(res, user);
    return res.json({ data: user.toSafeJSON() });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("kotha_token");
  res.json({ data: { loggedOut: true } });
});

router.get("/me", requireAuth, (req, res) =>
  res.json({ data: req.user.toSafeJSON() }),
);

module.exports = router;
