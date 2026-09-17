function emitToUser(req, userId, event, payload) {
  req.app.get("io")?.to(`user:${userId.toString()}`).emit(event, payload);
}

module.exports = { emitToUser };
