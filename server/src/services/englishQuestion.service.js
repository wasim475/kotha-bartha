const mongoose = require("mongoose");
const EnglishQuestion = require("../models/EnglishQuestion");
const GameAttempt = require("../models/GameAttempt");
const { GameError } = require("./games/GameError");
const { buildQuestion } = require("./games/questionBuilder");
const { shuffle } = require("./games/random");
const { englishWordBank, englishConversionBank } = require("./games/englishBanks");

const { QUESTION_TYPES } = EnglishQuestion;

const MAX_QUESTION_LENGTH = 500;
const MAX_OPTION_LENGTH = 200;
const OPTION_COUNT = 4;
const OPTION_LABELS = ["A", "B", "C", "D"];
const PAGE_SIZE = 20;

const normalizePrompt = (text) => String(text).trim().replace(/\s+/g, " ").toLowerCase();
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const invalid = (message) => new GameError(400, "VALIDATION_ERROR", message);

const isDuplicateKeyError = (error) => error?.code === 11000;
const isOnlyDuplicateKeyErrors = (error) => {
  if (isDuplicateKeyError(error)) return true;
  const errors = error?.writeErrors || [];
  return errors.length > 0 && errors.every((entry) => (entry.code ?? entry.err?.code) === 11000);
};

// ------------------------------------------------------------
// Seeding — copies the hardcoded defaults into the database
// ------------------------------------------------------------

// Idempotent and safe to run any number of times, from any number of
// processes: each seeded question is upserted by its `seedKey` with
// $setOnInsert only, so a second run inserts nothing, never overwrites an
// admin's edit, and never re-enables a question an admin disabled. If an admin
// already created the very same question by hand (the unique prompt index
// rejects the seed copy), that is simply skipped.
async function seedEnglishQuestions() {
  const operations = [];
  for (const [gameType, bank] of [
    ["english-word", englishWordBank],
    ["english-conversion", englishConversionBank],
  ]) {
    for (const item of bank) {
      const promptKey = normalizePrompt(item.prompt);
      const options = shuffle([item.answer, ...item.wrong]);
      const seedKey = `${gameType}:${promptKey}`;
      operations.push({
        updateOne: {
          filter: { seedKey },
          update: {
            $setOnInsert: {
              gameType,
              questionType: item.type,
              question: item.prompt,
              promptKey,
              options,
              correctIndex: options.indexOf(item.answer),
              active: true,
              seedKey,
            },
          },
          upsert: true,
        },
      });
    }
  }

  try {
    await EnglishQuestion.bulkWrite(operations, { ordered: false });
  } catch (error) {
    if (!isOnlyDuplicateKeyErrors(error)) throw error;
  }
}

// Once per process (retried if it failed) — cheap: one bulk of indexed upserts.
let seedPromise = null;
function ensureEnglishSeeded() {
  if (!seedPromise) {
    seedPromise = seedEnglishQuestions().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

// ------------------------------------------------------------
// Validation (create + edit)
// ------------------------------------------------------------

// Returns the cleaned, complete question fields, or throws a 400 GameError
// with a message an admin can act on.
function validateQuestionInput(input) {
  const questionType = input?.questionType;
  if (typeof questionType !== "string" || !QUESTION_TYPES[questionType]) {
    throw invalid("Choose a question type.");
  }

  if (typeof input.question !== "string" || !input.question.trim()) {
    throw invalid("The question can't be empty.");
  }
  const question = input.question.trim();
  if (question.length > MAX_QUESTION_LENGTH) {
    throw invalid(`The question is too long (max ${MAX_QUESTION_LENGTH} characters).`);
  }

  if (!Array.isArray(input.options) || input.options.length !== OPTION_COUNT) {
    throw invalid(`Exactly ${OPTION_COUNT} options are required.`);
  }
  const options = input.options.map((option, index) => {
    if (typeof option !== "string" || !option.trim()) throw invalid(`Option ${OPTION_LABELS[index]} can't be empty.`);
    const trimmed = option.trim();
    if (trimmed.length > MAX_OPTION_LENGTH) {
      throw invalid(`Option ${OPTION_LABELS[index]} is too long (max ${MAX_OPTION_LENGTH} characters).`);
    }
    return trimmed;
  });
  const seen = new Map();
  options.forEach((option, index) => {
    const key = option.toLowerCase();
    if (seen.has(key)) {
      throw invalid(`Options must all be different — Option ${OPTION_LABELS[seen.get(key)]} and Option ${OPTION_LABELS[index]} are the same.`);
    }
    seen.set(key, index);
  });

  const { correctIndex } = input;
  if (typeof correctIndex !== "number" || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= OPTION_COUNT) {
    throw invalid("Select the correct answer.");
  }

  return {
    questionType,
    gameType: QUESTION_TYPES[questionType].gameType,
    question,
    promptKey: normalizePrompt(question),
    options,
    correctIndex,
  };
}

// ------------------------------------------------------------
// Admin / moderator management
// ------------------------------------------------------------

// Admin-facing shape — includes the correct answer, so this must only ever be
// returned by the role-protected management routes.
const serializeQuestion = (doc) => ({
  id: doc._id.toString(),
  gameType: doc.gameType,
  questionType: doc.questionType,
  typeLabel: QUESTION_TYPES[doc.questionType]?.label || doc.questionType,
  question: doc.question,
  options: doc.options,
  correctIndex: doc.correctIndex,
  active: doc.active,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

// Live totals straight from the database — never hardcoded.
async function questionCounts() {
  const groups = await EnglishQuestion.aggregate([
    { $group: { _id: { gameType: "$gameType", active: "$active" }, count: { $sum: 1 } } },
  ]);

  const empty = () => ({ total: 0, active: 0, inactive: 0 });
  const counts = { ...empty(), byGame: { "english-word": empty(), "english-conversion": empty() } };
  for (const { _id, count } of groups) {
    const bucket = counts.byGame[_id.gameType] || (counts.byGame[_id.gameType] = empty());
    for (const target of [counts, bucket]) {
      target.total += count;
      target[_id.active ? "active" : "inactive"] += count;
    }
  }
  return counts;
}

async function listQuestions({ questionType, gameType, status, search, page }) {
  await ensureEnglishSeeded();

  const filter = {};
  if (questionType && QUESTION_TYPES[questionType]) filter.questionType = questionType;
  if (gameType === "english-word" || gameType === "english-conversion") filter.gameType = gameType;
  if (status === "active") filter.active = true;
  if (status === "inactive") filter.active = false;
  if (typeof search === "string" && search.trim()) {
    filter.question = { $regex: escapeRegExp(search.trim().slice(0, 100)), $options: "i" };
  }

  const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
  const [items, matching, counts] = await Promise.all([
    EnglishQuestion.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((pageNumber - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    EnglishQuestion.countDocuments(filter),
    questionCounts(),
  ]);

  return {
    items: items.map(serializeQuestion),
    meta: {
      counts,
      page: pageNumber,
      pageSize: PAGE_SIZE,
      matching,
      hasMore: pageNumber * PAGE_SIZE < matching,
      types: Object.entries(QUESTION_TYPES).map(([key, value]) => ({ key, label: value.label, gameType: value.gameType })),
    },
  };
}

async function createQuestion(user, input) {
  await ensureEnglishSeeded();
  const clean = validateQuestionInput(input);
  try {
    const doc = await EnglishQuestion.create({ ...clean, active: true, createdBy: user._id, updatedBy: user._id });
    return serializeQuestion(doc);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new GameError(409, "DUPLICATE_QUESTION", "This question already exists.");
    }
    throw error;
  }
}

async function findQuestion(id) {
  if (!mongoose.isValidObjectId(id)) throw new GameError(404, "NOT_FOUND", "Question not found.");
  const doc = await EnglishQuestion.findById(id);
  if (!doc) throw new GameError(404, "NOT_FOUND", "Question not found.");
  return doc;
}

// Edits any subset of the fields; the merged result is validated as a whole
// so a partial edit can never leave the question invalid.
async function updateQuestion(user, id, input) {
  const doc = await findQuestion(id);
  const clean = validateQuestionInput({
    questionType: input?.questionType ?? doc.questionType,
    question: input?.question ?? doc.question,
    options: input?.options ?? doc.options,
    correctIndex: input?.correctIndex ?? doc.correctIndex,
  });

  Object.assign(doc, clean, { updatedBy: user._id });
  try {
    await doc.save();
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new GameError(409, "DUPLICATE_QUESTION", "Another question with this text already exists.");
    }
    throw error;
  }
  return serializeQuestion(doc);
}

async function setQuestionActive(user, id, active) {
  if (typeof active !== "boolean") throw invalid("Send { active: true } or { active: false }.");
  const doc = await findQuestion(id);
  doc.active = active;
  doc.updatedBy = user._id;
  await doc.save();
  return serializeQuestion(doc);
}

// ------------------------------------------------------------
// Play-time selection — per-user, no repeats
// ------------------------------------------------------------

const NOT_ENOUGH_MESSAGE = "Not enough new English questions are available yet. Please try again later.";

// IDs of every English question this user has ever been assigned in this game
// (completed OR abandoned OR still in progress — "used" means assigned to an
// attempt), read from the GameAttempt collection itself: the database is the
// only source of truth, nothing comes from the browser.
//
// Attempts created before questions were tracked by ID have no `questionIds`;
// for those the embedded question text stands in, so a user who already played
// the default set doesn't see those questions again either.
async function usedHistory(userId, gameType) {
  const [ids, legacyPrompts] = await Promise.all([
    GameAttempt.distinct("questionIds", { userId, gameType }),
    GameAttempt.distinct("questions.prompt", { userId, gameType, "questionIds.0": { $exists: false } }),
  ]);
  return { ids, legacyPrompts };
}

// Picks `count` questions the user has never received, at random, on the
// server. Never repeats: if fewer than `count` unused active questions
// remain, no attempt is created and a clear 409 is returned instead.
// Returns { questions, questionIds } ready for a GameAttempt — each question
// carries its options in a fresh random order, and question order is random.
async function selectEnglishQuestions({ gameType, count, userId }) {
  await ensureEnglishSeeded();

  const { ids, legacyPrompts } = await usedHistory(userId, gameType);
  const filter = { gameType, active: true };
  if (ids.length) filter._id = { $nin: ids };
  if (legacyPrompts.length) filter.promptKey = { $nin: legacyPrompts.map(normalizePrompt) };

  const notEnough = (available) =>
    new GameError(409, "NOT_ENOUGH_QUESTIONS", NOT_ENOUGH_MESSAGE, { available, needed: count });

  const available = await EnglishQuestion.countDocuments(filter);
  if (available < count) throw notEnough(available);

  const picked = await EnglishQuestion.aggregate([{ $match: filter }, { $sample: { size: count } }]);
  if (picked.length < count) throw notEnough(picked.length);

  const ordered = shuffle(picked);
  return {
    questionIds: ordered.map((doc) => doc._id),
    questions: ordered.map((doc) =>
      buildQuestion({
        prompt: doc.question,
        correct: doc.options[doc.correctIndex],
        wrong: doc.options.filter((_, index) => index !== doc.correctIndex),
      }),
    ),
  };
}

module.exports = {
  QUESTION_TYPES,
  NOT_ENOUGH_MESSAGE,
  seedEnglishQuestions,
  ensureEnglishSeeded,
  validateQuestionInput,
  listQuestions,
  createQuestion,
  updateQuestion,
  setQuestionActive,
  selectEnglishQuestions,
  normalizePrompt,
};
