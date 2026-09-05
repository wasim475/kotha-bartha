require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const app = require("./app");

const port = process.env.PORT || 5000;
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  },
});
app.set("io", io);

io.use((socket, next) => {
  try {
    const cookie = socket.handshake.headers.cookie || "";
    const token = cookie.split(";").map((part) => part.trim())
      .find((part) => part.startsWith("kotha_token="))?.slice("kotha_token=".length);
    socket.userId = jwt.verify(token, process.env.JWT_SECRET).sub;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  socket.join(`user:${socket.userId}`);
  socket.on("disconnect", () => {});
});

async function start() {
  if (process.env.MONGODB_URI) await mongoose.connect(process.env.MONGODB_URI);
  httpServer.listen(port, () =>
    console.log(`KOTHA-BARTA Connected...`),
  );
}

start().catch((error) => {
  console.error("Unable to start API", error);
  process.exit(1);
});
