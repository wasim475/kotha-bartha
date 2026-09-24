const { generateMathQuestions } = require("./mathGenerator");
const { generateFromBank } = require("./questionBuilder");
const { englishWordBank, englishConversionBank } = require("./englishBanks");

// THE registry of playable game types. Everything type-specific — how its
// questions are produced, how it scores, how many questions it asks, whether
// each question is timed — is declared here and nowhere else. The service,
// routes and client never branch on a game type; they look it up here
// (server) or receive it from GET /games (client). Adding a game = adding
// one entry.
//
// Per entry:
//   type / category / name / description / icon — catalog + display data
//   questionCount — default length (the Game document can override it)
//   timeLimitSec  — seconds allowed per question, or null for untimed games.
//                   Enforced by the SERVER (see answerAttempt), and sent to
//                   the client only so it can draw the countdown.
//   scoring       — points per outcome { correct, wrong, timeout }; the
//                   server applies it, never the client
//   generate(n)   — returns n questions shaped { prompt, options[4], correctIndex }
//   isAvailable(n)— whether n questions can currently be produced

const DEFAULT_QUESTION_COUNT = 10;
const MATH_TIME_LIMIT_SEC = 10;
// Math is a speed game: a wrong answer AND a timeout each cost a point.
const MATH_SCORING = { correct: 1, wrong: -1, timeout: -1 };
const ENGLISH_SCORING = { correct: 1, wrong: 0, timeout: 0 };

const GAME_CATEGORIES = [
  { key: "math", label: "Math Games", icon: "🧮" },
  { key: "english", label: "English Games", icon: "🇬🇧" },
];

const mathGame = (operation, sortOrder, name, description, icon) => ({
  type: `math-${operation}`,
  category: "math",
  name,
  description,
  icon,
  sortOrder,
  questionCount: DEFAULT_QUESTION_COUNT,
  timeLimitSec: MATH_TIME_LIMIT_SEC,
  scoring: MATH_SCORING,
  generate: (count) => generateMathQuestions(operation, count),
  isAvailable: () => true,
});

const bankGame = ({ type, sortOrder, name, description, icon, bank }) => ({
  type,
  category: "english",
  name,
  description,
  icon,
  sortOrder,
  questionCount: DEFAULT_QUESTION_COUNT,
  timeLimitSec: null,
  scoring: ENGLISH_SCORING,
  generate: (count) => generateFromBank(bank, count),
  isAvailable: (count) => bank.length >= count,
});

const GAME_TYPES = [
  mathGame("addition", 10, "Addition", "Add two-digit numbers, fast.", "+"),
  mathGame("subtraction", 20, "Subtraction", "Subtract two-digit numbers.", "−"),
  mathGame("multiplication", 30, "Multiplication", "Times tables from 2 to 12.", "×"),
  mathGame("division", 40, "Division", "Clean division, no decimals.", "÷"),
  bankGame({
    type: "english-word",
    sortOrder: 110,
    name: "English Word Game",
    description: "Meanings, synonyms and antonyms.",
    icon: "Aa",
    bank: englishWordBank,
  }),
  bankGame({
    type: "english-conversion",
    sortOrder: 120,
    name: "English Conversion Game",
    description: "Bengali to English sentences.",
    icon: "⇄",
    bank: englishConversionBank,
  }),
];

const GAME_TYPES_BY_KEY = new Map(GAME_TYPES.map((definition) => [definition.type, definition]));

const getGameType = (type) => GAME_TYPES_BY_KEY.get(type) || null;

// Points for one answer under a game type's own scoring rule.
// outcome: "correct" | "wrong" | "timeout"
const pointsFor = (definition, outcome) => definition.scoring[outcome] ?? 0;

module.exports = { GAME_CATEGORIES, GAME_TYPES, getGameType, pointsFor, DEFAULT_QUESTION_COUNT };
