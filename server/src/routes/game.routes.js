const express = require("express");
const {
  GameError,
  listGames,
  startAttempt,
  getAttempt,
  answerAttempt,
} = require("../services/game.service");

const router = express.Router();

// Runs a service call and maps its GameError to the project's standard
// { error: { code, message } } response; anything unexpected goes to the
// shared error handler. `req.user` is guaranteed by the global requireAuth.
const respond = (handler) => async (req, res, next) => {
  try {
    res.json(await handler(req));
  } catch (error) {
    if (error instanceof GameError) {
      return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    }
    next(error);
  }
};

// Catalog: every game plus its category, and whether it's playable yet.
router.get(
  "/games",
  respond(async () => {
    const { games, categories } = await listGames();
    return { data: games, meta: { categories } };
  }),
);

// Start a new attempt for a game, or resume the user's unfinished one.
router.post(
  "/games/:gameType/start",
  respond(async (req) => ({ data: await startAttempt(req.user._id, req.params.gameType) })),
);

router.get(
  "/games/attempts/:attemptId",
  respond(async (req) => ({ data: await getAttempt(req.user._id, req.params.attemptId) })),
);

// Body: { questionIndex, selectedPosition }. Score, counts and completion are
// computed server-side — nothing else from the client is read.
router.post(
  "/games/attempts/:attemptId/answer",
  respond(async (req) => ({
    data: await answerAttempt(req.user._id, req.params.attemptId, {
      questionIndex: req.body?.questionIndex,
      selectedPosition: req.body?.selectedPosition,
    }),
  })),
);

module.exports = router;
