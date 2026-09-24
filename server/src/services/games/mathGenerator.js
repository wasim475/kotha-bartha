const { randomInt, shuffle } = require("./random");
const { buildQuestion, makeNumericDistractors } = require("./questionBuilder");

// Each operation knows only how to produce ONE random problem. Everything
// shared — de-duplication within a game, distractors, option shuffling —
// lives in generateMathQuestions below, so adding another operation is just
// another entry here.
//
// make() returns:
//   operands / answer — the problem itself
//   key               — identity for de-duplication (commutative operations
//                       key on the sorted operands so 12 × 7 and 7 × 12 are
//                       never both asked in the same game)
//   min / preferredOffsets — passed through to the distractor builder
const OPERATIONS = {
  addition: {
    symbol: "+",
    make() {
      const a = randomInt(10, 99);
      const b = randomInt(10, 99);
      return {
        operands: [a, b],
        answer: a + b,
        key: [a, b].sort((x, y) => x - y).join("+"),
        min: 0,
        preferredOffsets: [10],
      };
    },
  },
  subtraction: {
    symbol: "−",
    make() {
      let a = randomInt(10, 99);
      let b = randomInt(10, 99);
      while (a === b) b = randomInt(10, 99);
      // Larger number first — results are always positive.
      if (a < b) [a, b] = [b, a];
      return {
        operands: [a, b],
        answer: a - b,
        key: `${a}-${b}`,
        min: 0,
        preferredOffsets: [10],
      };
    },
  },
  multiplication: {
    symbol: "×",
    make() {
      const a = randomInt(2, 12);
      const b = randomInt(2, 12);
      return {
        operands: [a, b],
        answer: a * b,
        key: [a, b].sort((x, y) => x - y).join("x"),
        min: 1,
        // The classic slips: one factor too many/few, or a tens error.
        preferredOffsets: [a, b, 10],
      };
    },
  },
  division: {
    symbol: "÷",
    make() {
      // Build the dividend from the quotient so every answer is a clean
      // integer — a decimal result can never be generated.
      const divisor = randomInt(2, 12);
      const quotient = randomInt(2, 12);
      const dividend = divisor * quotient;
      return {
        operands: [dividend, divisor],
        answer: quotient,
        key: `${dividend}/${divisor}`,
        min: 1,
        preferredOffsets: [],
      };
    },
  },
};

const MAX_ATTEMPTS_PER_QUESTION = 50;

function generateMathQuestions(operation, count) {
  const definition = OPERATIONS[operation];
  if (!definition) throw new Error(`Unknown math operation: ${operation}`);

  const seen = new Set();
  const questions = [];

  for (let attempts = 0; questions.length < count && attempts < count * MAX_ATTEMPTS_PER_QUESTION; attempts++) {
    const problem = definition.make();
    if (seen.has(problem.key)) continue;
    seen.add(problem.key);

    const [left, right] = problem.operands;
    questions.push(
      buildQuestion({
        prompt: `${left} ${definition.symbol} ${right} = ?`,
        correct: problem.answer,
        wrong: makeNumericDistractors(problem.answer, {
          min: problem.min,
          preferredOffsets: problem.preferredOffsets,
        }),
      }),
    );
  }

  if (questions.length < count) {
    throw new Error(`Could not generate ${count} unique ${operation} questions.`);
  }

  return shuffle(questions);
}

module.exports = { OPERATIONS, generateMathQuestions };
