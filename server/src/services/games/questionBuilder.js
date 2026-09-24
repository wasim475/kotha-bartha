const { shuffle, sample } = require("./random");

const OPTION_COUNT = 4;

class InsufficientQuestionsError extends Error {
  constructor(message) {
    super(message);
    this.name = "InsufficientQuestionsError";
    this.code = "INSUFFICIENT_QUESTIONS";
  }
}

// The one place a finished, playable question is assembled — every game
// (generated math or a bank-backed English game) goes through here, so the
// correct answer's position is always randomized the same way and the
// stored shape is always { prompt, options[4], correctIndex }.
function buildQuestion({ prompt, correct, wrong }) {
  const choices = shuffle([
    { text: String(correct), isCorrect: true },
    ...wrong.map((text) => ({ text: String(text), isCorrect: false })),
  ]);

  const texts = choices.map((choice) => choice.text);
  if (choices.length !== OPTION_COUNT || new Set(texts).size !== OPTION_COUNT) {
    throw new Error(`Question "${prompt}" must have exactly ${OPTION_COUNT} distinct options.`);
  }

  return {
    prompt,
    options: texts,
    correctIndex: choices.findIndex((choice) => choice.isCorrect),
  };
}

// Plausible wrong integers near `answer`: never equal to it, never below
// `min` (so a subtraction game can't offer a negative option), and always
// exactly `count` distinct values. `preferredOffsets` lets an operation
// favour its own typical mistakes (e.g. off-by-one-multiple for ×).
function makeNumericDistractors(answer, { count = OPTION_COUNT - 1, min = 0, preferredOffsets = [] } = {}) {
  const pool = new Set();
  const add = (value) => {
    if (Number.isInteger(value) && value >= min && value !== answer) pool.add(value);
  };

  for (const offset of [...preferredOffsets, 1, 2, 3, 4, 5, 10]) {
    add(answer + offset);
    add(answer - offset);
  }
  for (let radius = 1; pool.size < count; radius++) {
    add(answer + radius);
    add(answer - radius);
  }

  return shuffle([...pool]).slice(0, count);
}

// Bank-backed games: each bank item is { prompt, answer, wrong: [3 strings] }.
// A fresh random sample is drawn per attempt (the bank itself is never
// reordered or mutated) and each drawn question gets its own option shuffle.
function generateFromBank(bank, count) {
  if (bank.length < count) {
    throw new InsufficientQuestionsError(`Needs at least ${count} questions, has ${bank.length}.`);
  }
  return sample(bank, count).map((item) =>
    buildQuestion({ prompt: item.prompt, correct: item.answer, wrong: item.wrong }),
  );
}

module.exports = {
  OPTION_COUNT,
  InsufficientQuestionsError,
  buildQuestion,
  makeNumericDistractors,
  generateFromBank,
};
