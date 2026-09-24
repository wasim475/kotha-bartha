// Shared by game.service.js and the English question service so neither has
// to require the other (the game registry needs the English selector, and the
// game service needs the registry — a direct import between the two services
// would be circular).
class GameError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = "GameError";
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

module.exports = { GameError };
