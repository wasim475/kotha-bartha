const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./routes/auth");
const dataRoutes = require("./routes");
const { uploadsDir } = require("./middleware/upload");

const app = express();
app.set("trust proxy", 1);
const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  "http://localhost:5173",
].filter(Boolean);
const corsOrigin = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error("Origin is not allowed by CORS"));
};
app.use(helmet());
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === "GET",
  }),
);

app.get("/api/v1/health", (req, res) =>
  res.json({ data: { status: "ok", service: "kotha-bartha-api" } }),
);

// Uploaded message attachments (images/files/voice notes) — served as
// plain static assets. Helmet's default same-origin CORP would otherwise
// block the client (a different origin in dev) from loading them.
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(uploadsDir, { maxAge: "7d", immutable: true }),
);

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1", dataRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong." },
  });
});

module.exports = app;

// app.js
