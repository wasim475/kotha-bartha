const mongoose = require("mongoose");
const Game = require("../models/Game");
const GameAttempt = require("../models/GameAttempt");
const { GAME_CATEGORIES, GAME_TYPES, getGameType, pointsFor } = require("./games/gameTypes");
const { OPTION_COUNT } = require("./games/questionBuilder");

class GameError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "GameError";
    this.status = status;
    this.code = code;
  }
}

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
// currently supply enough questions (an English game with an empty bank is
// therefore "coming soon" without any flag having to be flipped by hand).
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
        available: isPlayable(game, definition),
      })),
    categories: GAME_CATEGORIES,
  };
}

// ------------------------------------------------------------
// Attempts
// ------------------------------------------------------------

const accuracyOf = (attempt) =>
  attempt.questions.length ? Math.round((attempt.correctCount / attempt.questions.length) * 100) : 0;

// The single place that decides what an attempt looks like to the client.
// Every question's prompt and (already shuffled) options are included, but
// the correct answer is included only for questions already answered.
async function serializeAttempt(attempt) {
  const game = await Game.findOne({ type: attempt.gameType }).select("name icon").lean();
  const definition = getGameType(attempt.gameType);
  const answersByIndex = new Map(attempt.answers.map((answer) => [answer.questionIndex, answer]));

  return {
    attemptId: attempt._id.toString(),
    gameType: attempt.gameType,
    category: attempt.category,
    gameName: game?.name || definition?.name || attempt.gameType,
    icon: game?.icon || definition?.icon || "",
    status: attempt.status,
    currentIndex: attempt.currentIndex,
    totalQuestions: attempt.questions.length,
    score: attempt.score,
    correctCount: attempt.correctCount,
    wrongCount: attempt.wrongCount,
    accuracy: accuracyOf(attempt),
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt || null,
    questions: attempt.questions.map((question, index) => {
      const answer = answersByIndex.get(index);
      const item = { index, prompt: question.prompt, options: question.options, answered: Boolean(answer) };
      if (answer) {
        item.selectedPosition = answer.selectedPosition;
        item.correct = answer.correct;
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
    const questions = definition.generate(game.questionCount);
    try {
      attempt = await GameAttempt.create({
        userId,
        gameId: game._id,
        gameType,
        category: game.category,
        questions,
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

// Grades one answer. The client sends only which question and which
// option position — correctness, points, counts and completion are all
// decided and written here.
async function answerAttempt(userId, attemptId, { questionIndex, selectedPosition }) {
  const attempt = await findOwnedAttempt(userId, attemptId);

  if (attempt.status === "completed") {
    throw new GameError(400, "ALREADY_COMPLETED", "This game is already finished.");
  }

  // Strictly typed integers only — never coerced with Number(), which would
  // silently turn null / "" / [] / true into 0 or 1 and record a phantom answer.
  const isInteger = (value) => typeof value === "number" && Number.isInteger(value);
  if (!isInteger(questionIndex) || !isInteger(selectedPosition)) {
    throw new GameError(400, "VALIDATION_ERROR", "Choose an option.");
  }
  if (selectedPosition < 0 || selectedPosition >= OPTION_COUNT) {
    throw new GameError(400, "VALIDATION_ERROR", "Choose an option.");
  }
  // Only the CURRENT question can be answered — blocks replaying an
  // answered question or skipping ahead with an arbitrary index.
  if (questionIndex !== attempt.currentIndex) {
    throw new GameError(409, "OUT_OF_SEQUENCE", "That question isn't currently active.");
  }
  const index = questionIndex;
  const position = selectedPosition;

  const question = attempt.questions[index];
  const correct = position === question.correctIndex;
  const definition = getGameType(attempt.gameType);
  const points = definition ? pointsFor(definition, correct) : correct ? 1 : 0;
  const isComplete = index + 1 >= attempt.questions.length;

  const update = {
    $push: {
      answers: {
        questionIndex: index,
        selectedPosition: position,
        correct,
        pointsAwarded: points,
        answeredAt: new Date(),
      },
    },
    $inc: {
      currentIndex: 1,
      score: points,
      [correct ? "correctCount" : "wrongCount"]: 1,
    },
  };
  if (isComplete) update.$set = { status: "completed", completedAt: new Date() };

  // Atomic and conditional on the question still being current: if two
  // requests for the same question race (a double-click, two tabs), only the
  // first matches and is scored — the second finds currentIndex already
  // advanced and is rejected, so an answer can never be counted twice.
  const updated = await GameAttempt.findOneAndUpdate(
    { _id: attempt._id, userId, status: "playing", currentIndex: index },
    update,
    { returnDocument: "after" },
  );
  if (!updated) {
    throw new GameError(409, "OUT_OF_SEQUENCE", "That question was already answered.");
  }

  return {
    correct,
    correctPosition: question.correctIndex,
    scoreDelta: points,
    score: updated.score,
    correctCount: updated.correctCount,
    wrongCount: updated.wrongCount,
    currentIndex: updated.currentIndex,
    totalQuestions: updated.questions.length,
    accuracy: accuracyOf(updated),
    status: updated.status,
    isComplete,
  };
}

module.exports = {
  GameError,
  ensureGamesSynced,
  listGames,
  startAttempt,
  getAttempt,
  answerAttempt,
};
