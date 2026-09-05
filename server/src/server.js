require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const app = require("./app");

const port = process.env.PORT || 5000;
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || "https://kotha-barta.netlify.app/signup" || "http://localhost:5173",
    credentials: true,
  },
});

io.on("connection", (socket) => {
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
