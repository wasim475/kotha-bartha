require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const app = require("./app");
const Conversation = require("./models/Conversation");
const User = require("./models/User");
const { pairKey } = require("./utils/ids");
const { isBlockedEitherWay } = require("./utils/blocks");
const { addConnection, removeConnection, isOnline } = require("./utils/presence");

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

const notifyPartners = async (userId, payload) => {
  const conversations = await Conversation.find({ participantIds: userId }).select(
    "participantIds",
  );
  const partnerIds = new Set(
    conversations.map((conversation) =>
      conversation.participantIds
        .find((id) => id.toString() !== userId.toString())
        ?.toString(),
    ),
  );
  partnerIds.forEach((partnerId) => {
    if (partnerId) io.to(`user:${partnerId}`).emit("presence:update", payload);
  });
};

io.on("connection", (socket) => {
  socket.join(`user:${socket.userId}`);

  if (addConnection(socket.userId)) {
    notifyPartners(socket.userId, { userId: socket.userId, isOnline: true }).catch(
      (error) => console.error("presence broadcast failed:", error),
    );
  }

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
    console.log("DEBUG call:signal received", { from: socket.userId, to, type: signal?.type });
    if (typeof to !== "string" || !signal) return;

    // Only the call-initiating "offer" needs the authorization check —
    // answer/ice/end are just completing a call that already passed it.
    if (signal.type === "offer") {
      const [authorized, blocked] = await Promise.all([
        Conversation.exists({ pairKey: pairKey(socket.userId, to) }),
        isBlockedEitherWay(socket.userId, to),
      ]);
      console.log("DEBUG offer auth check", { authorized, blocked });
      if (!authorized || blocked) return;
    }

    const room = io.sockets.adapter.rooms.get(`user:${to}`);
    console.log("DEBUG room size before forward", `user:${to}`, room ? room.size : 0, room ? [...room] : []);
    io.to(`user:${to}`).emit("call:signal", { from: socket.userId, signal });
    console.log("DEBUG call:signal forwarded to", `user:${to}`);
  });
  socket.on("disconnect", async () => {
    if (!removeConnection(socket.userId)) return;

    try {
      const user = await User.findByIdAndUpdate(
        socket.userId,
        { lastSeenAt: new Date() },
        { new: true },
      );
      await notifyPartners(socket.userId, {
        userId: socket.userId,
        isOnline: false,
        lastSeenAt: user?.lastSeenAt,
      });
    } catch (error) {
      console.error("presence disconnect update failed:", error);
    }
  });
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
