const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./routes/auth");
const dataRoutes = require("./routes/data");

const app = express();
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true }),
);



app.get("/api/v1/health", (req, res) =>
  res.json({ data: { status: "ok", service: "kotha-bartha-api" } }),
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
