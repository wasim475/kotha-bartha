// Shared harness for the Ludo integration tests (they need MONGODB_URI, exactly like the
// app): an API + Socket.IO host that wires the SAME handlers server.js does (auth,
// presence, Tic-Tac-Toe presence, Ludo), throwaway "ZZ" users (deleted by exact id at the
// end — real accounts are never touched), and small helpers.
const path = require("path");
const http = require("http");
const sr = path.join(__dirname, "..", "..");
const cr = path.join(sr, "..", "client");
require(path.join(sr, "node_modules", "dotenv")).config({ path: path.join(sr, ".env"), quiet: true });
const mongoose = require(path.join(sr, "node_modules", "mongoose"));
const jwt = require(path.join(sr, "node_modules", "jsonwebtoken"));
const { Server } = require(path.join(sr, "node_modules", "socket.io"));
const { io: ioClient } = require(path.join(cr, "node_modules", "socket.io-client"));
const M = (n) => require(path.join(sr, "src", "models", n));
const S = (n) => require(path.join(sr, "src", n));

const User = M("User"), Friendship = M("Friendship"), LudoGame = M("LudoGame"), LudoInvite = M("LudoInvite"), Notification = M("Notification");
const { pairKey } = S("utils/ids");
const presence = S("utils/presence");
const tttService = S("services/ticTacToe.service");
const ludo = S("services/ludo.service");
const { registerLudoSocket } = S("sockets/ludo.socket");
const engine = S("games/ludo/engine");
const { rollDie } = S("games/ludo/rng");
const app = S("app");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (n, ok, d = "") => { if (!ok) failures++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d !== "" ? "  " + d : ""}`); };
const until = async (fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch { /* poll */ } await sleep(120); } return false; };

async function start({ userNames = ["A", "B", "C", "D", "E"], suffix = "lud" } = {}) {
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all([LudoGame.init(), LudoInvite.init()]);
  const tag = `zz${suffix}${Date.now()}`;
  const users = {};
  for (const n of userNames) users[n] = await User.create({ fullName: `ZZ LUDO ${n}`, email: `${tag}-${n.toLowerCase()}@example.invalid`, passwordHash: "x", role: "user" });
  const tok = (u) => jwt.sign({ sub: u._id.toString() }, process.env.JWT_SECRET, { expiresIn: "50m" });
  const tokens = Object.fromEntries(Object.entries(users).map(([k, u]) => [k, tok(u)]));

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, { cors: { origin: true, credentials: true } });
  app.set("io", io);
  io.use((socket, next) => {
    try {
      const c = socket.handshake.headers.cookie || "";
      socket.userId = jwt.verify(c.split("kotha_token=")[1], process.env.JWT_SECRET).sub;
      next();
    } catch { next(new Error("Unauthorized")); }
  });
  io.on("connection", (socket) => {
    socket.join(`user:${socket.userId}`);
    if (presence.addConnection(socket.userId)) tttService.announcePresence(io, socket.userId, true).catch(() => {});
    registerLudoSocket(io, socket);
    socket.on("disconnect", () => { if (presence.removeConnection(socket.userId)) tttService.announcePresence(io, socket.userId, false).catch(() => {}); });
  });
  await new Promise((r) => httpServer.listen(0, r));
  const port = httpServer.address().port;
  const base = `http://127.0.0.1:${port}/api/v1`;

  const api = async (method, url, who, body) => {
    const res = await fetch(base + url, { method, headers: { "Content-Type": "application/json", ...(who ? { Authorization: `Bearer ${tokens[who] || who}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    let json = null; try { json = await res.json(); } catch { /* */ }
    return { status: res.status, json, code: json?.error?.code, data: json?.data };
  };

  const sockets = [];
  const connect = async (who) => {
    const sock = ioClient(`http://127.0.0.1:${port}`, { extraHeaders: { cookie: `kotha_token=${tokens[who]}` }, transports: ["websocket"], forceNew: true });
    sock.log = [];
    sock.onAny((event, payload) => sock.log.push({ event, payload }));
    await new Promise((resolve, reject) => { sock.on("connect", resolve); sock.on("connect_error", reject); });
    sockets.push(sock);
    sock.ask = (event, payload) => new Promise((resolve) => sock.timeout(8000).emit(event, payload, (err, res) => resolve(err ? { ok: false, error: { code: "TIMEOUT" } } : res)));
    sock.events = (name) => sock.log.filter((entry) => entry.event === name).map((entry) => entry.payload);
    sock.last = (name) => sock.events(name).at(-1);
    return sock;
  };

  const befriend = async (a, b) => Friendship.create({ userIds: [users[a]._id, users[b]._id], pairKey: pairKey(users[a]._id, users[b]._id) });

  const forceDice = async (gameId, value) => {
    for (let seed = 1; seed < 5000; seed++) {
      if (rollDie(seed).value === value) { await LudoGame.updateOne({ _id: gameId }, { $set: { "state.rng": seed } }); return; }
    }
    throw new Error("no seed");
  };
  const setTokens = (gameId, seat, positions) => {
    const $set = {};
    positions.forEach((pos, i) => { $set[`state.players.${seatIndex(gameId, seat)}.tokens.${i}.pos`] = pos; });
    return $set;
  };
  const seatIndexCache = new Map();
  function seatIndex(gameId, seat) { return seatIndexCache.get(`${gameId}:${seat}`) ?? 0; }
  const patchState = async (gameId, mutate) => {
    const doc = await LudoGame.findById(gameId).lean();
    const state = JSON.parse(JSON.stringify(doc.state));
    mutate(state);
    await LudoGame.updateOne({ _id: gameId }, { $set: { state } });
    return state;
  };

  const cleanup = async () => {
    for (const s of sockets) s.close();
    const ids = Object.values(users).map((u) => u._id);
    const games = await LudoGame.find({ $or: [{ hostId: { $in: ids } }, { "members.userId": { $in: ids } }] }).select("_id").lean();
    const gameIds = games.map((g) => g._id);
    const invites = await LudoInvite.deleteMany({ $or: [{ gameId: { $in: gameIds } }, { inviterId: { $in: ids } }, { inviteeId: { $in: ids } }] });
    const notes = await Notification.deleteMany({ $or: [{ recipientId: { $in: ids } }, { actorId: { $in: ids } }] });
    await LudoGame.deleteMany({ _id: { $in: gameIds } });
    await Friendship.deleteMany({ userIds: { $in: ids } });
    await User.deleteMany({ _id: { $in: ids } });
    console.log(`cleanup: ${gameIds.length} games, ${invites.deletedCount} invites, ${notes.deletedCount} notifications, ${ids.length} users`);
    await new Promise((r) => httpServer.close(r));
    await mongoose.disconnect();
  };

  return { users, tokens, api, connect, befriend, forceDice, patchState, cleanup, io, base, port, ludo, engine, LudoGame, LudoInvite, Notification, User, Friendship, check, sleep, until, done: () => failures };
}

module.exports = { start, check, sleep, until, sr, cr, engine, rollDie, LudoGame, mongoose, done: () => failures };
