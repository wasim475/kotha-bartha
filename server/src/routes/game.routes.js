const express = require("express");
const {
  GameError,
  listGames,
  startAttempt,
  getAttempt,
  answerAttempt,
  getLastCompleted,
  getReview,
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
      return res
        .status(error.status)
        .json({ error: { code: error.code, message: error.message, ...error.extra } });
    }
    next(error);
  }
};

// Catalog: every game plus its category, time limit, and whether it's playable yet.
router.get(
  "/games",
  respond(async () => {
    const { games, categories } = await listGames();
    return { data: games, meta: { categories } };
  }),
);

// Summary of the user's last COMPLETED game (data: null if they have none).
// Registered before the :gameType routes so "last" is never read as a game type.
router.get(
  "/games/last",
  respond(async (req) => ({ data: await getLastCompleted(req.user._id) })),
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

// Mistakes (wrong + timed-out questions, with correct answers) of a COMPLETED attempt.
router.get(
  "/games/attempts/:attemptId/review",
  respond(async (req) => ({ data: await getReview(req.user._id, req.params.attemptId) })),
);

// Body: { questionIndex, selectedPosition } — or { questionIndex, timedOut: true }
// when the client's countdown reached zero. Score, counts, timing verdict and
// completion are all decided server-side — nothing else from the client is read.
router.post(
  "/games/attempts/:attemptId/answer",
  respond(async (req) => ({
    data: await answerAttempt(
      req.user._id,
      req.params.attemptId,
      {
        questionIndex: req.body?.questionIndex,
        selectedPosition: req.body?.selectedPosition,
        timedOut: req.body?.timedOut,
      },
      Date.now(),
    ),
  })),
);

module.exports = router;
