const mongoose = require("mongoose");
const Game = require("../models/Game");
const GameAttempt = require("../models/GameAttempt");
const { GAME_CATEGORIES, GAME_TYPES, EXTERNAL_GAMES, getGameType, pointsFor } = require("./games/gameTypes");
const { OPTION_COUNT } = require("./games/questionBuilder");
const { GameError } = require("./games/GameError");

// ------------------------------------------------------------
// Question timing (timed games only — see timeLimitSec in gameTypes.js)
//
// The server owns the clock. Each attempt stores `questionStartedAt`, when
// the CURRENT question's window opens, and every answer/timeout is measured
// against it using the time the request ARRIVED — never a client-reported
// "time remaining". After each answer the next question's window is scheduled
// to open ACTIVATION_DELAY_MS later, which is how long the client keeps the
// result on screen (about 1s hold + a short fade) before the next question
// appears, so the player gets the full time limit rather than losing the
// result animation out of their 10 seconds.
// ------------------------------------------------------------
const ACTIVATION_DELAY_MS = 1200;
// Network slack: an answer that arrives up to this long after the limit is
// still graded normally, so an honest player on a slow connection isn't
// timed out for latency. Anything later is a timeout, however the client
// describes it.
const TIME_LIMIT_GRACE_MS = 1500;
// A client can report "my timer hit zero" only once the server agrees the
// window has (nearly) closed; otherwise the claim is rejected.
const EARLY_TIMEOUT_TOLERANCE_MS = 250;

// ------------------------------------------------------------
// Catalog
// ------------------------------------------------------------

// Creates any missing Game rows from the registry, once per process (and
// retried if it failed). Existing rows keep whatever name / description /
// questionCount / active they already have — only structural fields are
// refreshed — so a value tuned in the database survives restarts.
let syncPromise = null;
function ensureGamesSynced() {
  if (!syncPromise) {
    syncPromise = Game.bulkWrite(
      GAME_TYPES.map((definition) => ({
        updateOne: {
          filter: { type: definition.type },
          update: {
            $set: {
              category: definition.category,
              icon: definition.icon,
              sortOrder: definition.sortOrder,
            },
            $setOnInsert: {
              name: definition.name,
              description: definition.description,
              questionCount: definition.questionCount,
              active: true,
            },
          },
          upsert: true,
        },
      })),
    ).catch((error) => {
      syncPromise = null;
      throw error;
    });
  }
  return syncPromise;
}

// A game is playable only when it's switched on AND its question source can
// currently supply enough questions.
const isPlayable = (game, definition) =>
  Boolean(definition) && game.active && definition.isAvailable(game.questionCount);

async function listGames() {
  await ensureGamesSynced();
  const games = await Game.find({}).sort({ sortOrder: 1 }).lean();

  return {
    games: games
      .map((game) => ({ game, definition: getGameType(game.type) }))
      .filter(({ definition }) => definition)
      .map(({ game, definition }) => ({
        type: game.type,
        category: game.category,
        name: game.name,
        description: game.description,
        icon: game.icon,
        questionCount: game.questionCount,
        timeLimitSec: definition.timeLimitSec,
        supportsChallenge: Boolean(definition.supportsChallenge),
        available: isPlayable(game, definition),
      }))
      .concat(EXTERNAL_GAMES.map(({ sortOrder, ...game }) => ({ ...game, available: true }))),
    categories: GAME_CATEGORIES,
  };
}

// ------------------------------------------------------------
// Attempts
// ------------------------------------------------------------

const accuracyOf = (attempt) =>
  attempt.questions.length ? Math.round((attempt.correctCount / attempt.questions.length) * 100) : 0;

const timeoutCountOf = (attempt) => attempt.answers.filter((answer) => answer.timedOut).length;

// Milliseconds left in the current question's window, or null for an
// untimed game / finished attempt. Clamped to [0, limit] — a window that
// hasn't opened yet (the short gap after an answer) reports the full limit.
function remainingMsFor(attempt, now) {
  if (!attempt.timeLimitMs || attempt.status !== "playing" || !attempt.questionStartedAt) return null;
  const elapsed = now - attempt.questionStartedAt.getTime();
  return Math.max(0, Math.min(attempt.timeLimitMs, attempt.timeLimitMs - elapsed));
}

async function gameDisplay(gameType) {
  const game = await Game.findOne({ type: gameType }).select("name icon").lean();
  const definition = getGameType(gameType);
  return {
    gameName: game?.name || definition?.name || gameType,
    icon: game?.icon || definition?.icon || "",
  };
}

// The result numbers shared by the result screen, the review and the
// "last game" summary — always straight from the stored attempt.
const summaryFields = (attempt) => ({
  attemptId: attempt._id.toString(),
  gameType: attempt.gameType,
  category: attempt.category,
  status: attempt.status,
  totalQuestions: attempt.questions.length,
  score: attempt.score,
  correctCount: attempt.correctCount,
  wrongCount: attempt.wrongCount,
  timeoutCount: timeoutCountOf(attempt),
  accuracy: accuracyOf(attempt),
  completedAt: attempt.completedAt || null,
});

// The single place that decides what an attempt looks like to the client
// DURING and right after play. Every question's prompt and (already
// shuffled) options are included, but the correct answer is included only
// for questions already answered (or timed out).
async function serializeAttempt(attempt, now = Date.now()) {
  const display = await gameDisplay(attempt.gameType);
  const answersByIndex = new Map(attempt.answers.map((answer) => [answer.questionIndex, answer]));

  return {
    ...summaryFields(attempt),
    ...display,
    currentIndex: attempt.currentIndex,
    startedAt: attempt.startedAt,
    // Timer configuration comes from the game itself; `remainingMs` is the
    // server's own reading of the current question's clock.
    timeLimitSec: attempt.timeLimitMs ? attempt.timeLimitMs / 1000 : null,
    remainingMs: remainingMsFor(attempt, now),
    questions: attempt.questions.map((question, index) => {
      const answer = answersByIndex.get(index);
      const item = { index, prompt: question.prompt, options: question.options, answered: Boolean(answer) };
      if (answer) {
        item.selectedPosition = answer.selectedPosition ?? null;
        item.correct = answer.correct;
        item.timedOut = Boolean(answer.timedOut);
        item.correctPosition = question.correctIndex;
      }
      return item;
    }),
  };
}

const findPlayingAttempt = (userId, gameType) =>
  GameAttempt.findOne({ userId, gameType, status: "playing" });

// Starts a new attempt, or resumes the user's unfinished one for this game.
async function startAttempt(userId, gameType) {
  const definition = getGameType(gameType);
  if (!definition) throw new GameError(404, "GAME_NOT_FOUND", "Game not found.");

  await ensureGamesSynced();
  const game = await Game.findOne({ type: gameType });
  if (!game) throw new GameError(404, "GAME_NOT_FOUND", "Game not found.");
  if (!isPlayable(game, definition)) {
    throw new GameError(409, "GAME_UNAVAILABLE", "This game isn't available yet.");
  }

  let attempt = await findPlayingAttempt(userId, gameType);

  if (!attempt) {
    // Selection happens here, on the server, for THIS user — for English it
    // excludes every question the user has been given before and throws
    // NOT_ENOUGH_QUESTIONS rather than ever repeating one.
    const generated = await definition.generate({ count: game.questionCount, userId });
    const timeLimitMs = definition.timeLimitSec ? definition.timeLimitSec * 1000 : null;
    try {
      attempt = await GameAttempt.create({
        userId,
        gameId: game._id,
        gameType,
        category: game.category,
        questions: generated.questions,
        questionIds: generated.questionIds || [],
        timeLimitMs,
        // The first question's window opens the moment the attempt exists.
        questionStartedAt: timeLimitMs ? new Date() : null,
      });
    } catch (createError) {
      if (createError.code === 11000) {
        // Lost a race against another in-flight "start" for the same user +
        // game — whichever one landed is the attempt to resume.
        attempt = await findPlayingAttempt(userId, gameType);
        if (!attempt) throw createError;
      } else {
        throw createError;
      }
    }
  }

  return serializeAttempt(attempt);
}

async function findOwnedAttempt(userId, attemptId) {
  if (!mongoose.isValidObjectId(attemptId)) {
    throw new GameError(404, "NOT_FOUND", "Attempt not found.");
  }
  const attempt = await GameAttempt.findOne({ _id: attemptId, userId });
  if (!attempt) throw new GameError(404, "NOT_FOUND", "Attempt not found.");
  return attempt;
}

async function getAttempt(userId, attemptId) {
  return serializeAttempt(await findOwnedAttempt(userId, attemptId));
}

const isInteger = (value) => typeof value === "number" && Number.isInteger(value);

// Grades one answer — or one timeout. The client sends only which question
// and which option position (or `timedOut: true` when its countdown hit
// zero). Correctness, timing verdict, points, counts and completion are all
// decided and written here; any other field in the request is ignored.
async function answerAttempt(userId, attemptId, body, receivedAt = Date.now()) {
  const attempt = await findOwnedAttempt(userId, attemptId);

  if (attempt.status === "completed") {
    throw new GameError(400, "ALREADY_COMPLETED", "This game is already finished.");
  }

  const { questionIndex, selectedPosition } = body;
  const timed = Boolean(attempt.timeLimitMs);
  const claimsTimeout = body.timedOut === true;

  // Strictly typed integers only — never coerced with Number(), which would
  // silently turn null / "" / [] / true into 0 or 1 and record a phantom answer.
  if (!isInteger(questionIndex)) {
    throw new GameError(400, "VALIDATION_ERROR", "Choose an option.");
  }
  if (claimsTimeout) {
    if (!timed) throw new GameError(400, "VALIDATION_ERROR", "This game has no time limit.");
  } else if (!isInteger(selectedPosition) || selectedPosition < 0 || selectedPosition >= OPTION_COUNT) {
    throw new GameError(400, "VALIDATION_ERROR", "Choose an option.");
  }
  // Only the CURRENT question can be answered — blocks replaying an
  // answered question or skipping ahead with an arbitrary index.
  if (questionIndex !== attempt.currentIndex) {
    throw new GameError(409, "OUT_OF_SEQUENCE", "That question isn't currently active.");
  }

  // Timing verdict (timed games): measured on the server clock only.
  let timedOut = false;
  if (timed) {
    const startedAt = attempt.questionStartedAt ? attempt.questionStartedAt.getTime() : receivedAt;
    const elapsed = receivedAt - startedAt;
    if (claimsTimeout) {
      const remaining = attempt.timeLimitMs - EARLY_TIMEOUT_TOLERANCE_MS - elapsed;
      if (remaining > 0) {
        throw new GameError(409, "TOO_EARLY", "That question hasn't timed out yet.", {
          retryAfterMs: remaining,
        });
      }
      timedOut = true;
    } else if (elapsed > attempt.timeLimitMs + TIME_LIMIT_GRACE_MS) {
      // Answered too late: a timeout, even if the option chosen was right.
      timedOut = true;
    }
  }

  const question = attempt.questions[questionIndex];
  const correct = !timedOut && selectedPosition === question.correctIndex;
  const outcome = timedOut ? "timeout" : correct ? "correct" : "wrong";
  const definition = getGameType(attempt.gameType);
  const points = definition ? pointsFor(definition, outcome) : correct ? 1 : 0;
  const isComplete = questionIndex + 1 >= attempt.questions.length;

  const update = {
    $push: {
      answers: {
        questionIndex,
        selectedPosition: timedOut ? null : selectedPosition,
        correct,
        timedOut,
        pointsAwarded: points,
        answeredAt: new Date(receivedAt),
      },
    },
    $inc: {
      currentIndex: 1,
      score: points,
      // A timeout is a wrong answer.
      [correct ? "correctCount" : "wrongCount"]: 1,
    },
  };
  const $set = {};
  if (isComplete) {
    $set.status = "completed";
    $set.completedAt = new Date();
  } else if (timed) {
    // The next question's window opens after the result has been shown.
    $set.questionStartedAt = new Date(receivedAt + ACTIVATION_DELAY_MS);
  }
  if (Object.keys($set).length) update.$set = $set;

  // Atomic and conditional on the question still being current: if two
  // requests for the same question race (a double-click, two tabs, an answer
  // racing its own timeout), only the first matches and is scored — the
  // second finds currentIndex already advanced and is rejected, so an answer
  // can never be counted twice.
  const updated = await GameAttempt.findOneAndUpdate(
    { _id: attempt._id, userId, status: "playing", currentIndex: questionIndex },
    update,
    { returnDocument: "after" },
  );
  if (!updated) {
    throw new GameError(409, "OUT_OF_SEQUENCE", "That question was already answered.");
  }

  return {
    correct,
    timedOut,
    correctPosition: question.correctIndex,
    scoreDelta: points,
    ...summaryFields(updated),
    currentIndex: updated.currentIndex,
    isComplete,
  };
}

// ------------------------------------------------------------
// Last-game review (completed attempts only)
// ------------------------------------------------------------

// The user's most recent COMPLETED game, or null. An in-progress attempt
// never appears here, so starting a new game doesn't hide or overwrite the
// previous result — it stays until the new game is actually completed.
async function getLastCompleted(userId) {
  const attempt = await GameAttempt.findOne({ userId, status: "completed" }).sort({ completedAt: -1 });
  if (!attempt) return null;
  return {
    ...summaryFields(attempt),
    ...(await gameDisplay(attempt.gameType)),
    mistakeCount: attempt.answers.filter((answer) => !answer.correct).length,
  };
}

// Only the questions answered wrongly or timed out, with the correct answer
// revealed — and only once the whole game is finished, so this can never be
// used to read answers mid-game.
async function getReview(userId, attemptId) {
  const attempt = await findOwnedAttempt(userId, attemptId);
  if (attempt.status !== "completed") {
    throw new GameError(409, "NOT_COMPLETED", "Finish the game to review your mistakes.");
  }

  const mistakes = attempt.answers
    .filter((answer) => !answer.correct)
    .sort((a, b) => a.questionIndex - b.questionIndex)
    .map((answer) => {
      const question = attempt.questions[answer.questionIndex];
      return {
        index: answer.questionIndex,
        number: answer.questionIndex + 1,
        prompt: question.prompt,
        status: answer.timedOut ? "timeout" : "wrong",
        selectedText: answer.timedOut ? null : (question.options[answer.selectedPosition] ?? null),
        correctText: question.options[question.correctIndex],
      };
    });

  return {
    ...summaryFields(attempt),
    ...(await gameDisplay(attempt.gameType)),
    mistakes,
  };
}

module.exports = {
  GameError,
  ensureGamesSynced,
  listGames,
  startAttempt,
  getAttempt,
  answerAttempt,
  getLastCompleted,
  getReview,
};
