require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const app = require("./app");
const Conversation = require("./models/Conversation");
const { pairKey } = require("./utils/ids");
const { isBlockedEitherWay } = require("./utils/blocks");

const port = process.env.PORT || 5000;
const httpServer = http.createServer(app);
const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  "http://localhost:5173",
].filter(Boolean);
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});
app.set("io", io);

io.use((socket, next) => {
  try {
    const cookie = socket.handshake.headers.cookie || "";
    const token = cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("kotha_token="))
      ?.slice("kotha_token=".length);
    socket.userId = jwt.verify(token, process.env.JWT_SECRET).sub;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  socket.join(`user:${socket.userId}`);
  const forwardTyping =
    (event) =>
    ({ to, conversationId }) => {
      if (typeof to === "string" && typeof conversationId === "string") {
        io.to(`user:${to}`).emit(event, {
          conversationId,
          senderId: socket.userId.toString(),
        });
      }
    };

  socket.on("typing:start", forwardTyping("typing:start"));
  socket.on("typing:stop", forwardTyping("typing:stop"));
  socket.on("call:signal", async ({ to, signal }) => {
    if (typeof to !== "string" || !signal) return;

    // Only the call-initiating "offer" needs the authorization check —
    // answer/ice/end are just completing a call that already passed it.
    if (signal.type === "offer") {
      const [authorized, blocked] = await Promise.all([
        Conversation.exists({ pairKey: pairKey(socket.userId, to) }),
        isBlockedEitherWay(socket.userId, to),
      ]);
      if (!authorized || blocked) return;
    }

    io.to(`user:${to}`).emit("call:signal", { from: socket.userId, signal });
  });
  socket.on("disconnect", () => {});
});

async function start() {
  if (process.env.MONGODB_URI) await mongoose.connect(process.env.MONGODB_URI);
  httpServer.listen(port, () => console.log(`KOTHA-BARTA Connected...`));
}

start().catch((error) => {
  console.error("Unable to start API", error);
  process.exit(1);
});

// server.js
