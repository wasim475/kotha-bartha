const { GameError } = require("../services/games/GameError");

// Runs a service call and maps its GameError to the project's standard
// { error: { code, message, ...extra } } response; anything unexpected goes to
// the shared error handler. `req.user` is guaranteed by the global requireAuth.
const respond = (handler, status = 200) => async (req, res, next) => {
  try {
    res.status(status).json(await handler(req));
  } catch (error) {
    if (error instanceof GameError) {
      return res
        .status(error.status)
        .json({ error: { code: error.code, message: error.message, ...error.extra } });
    }
    next(error);
  }
};

module.exports = { respond };
