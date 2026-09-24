// Question banks for the English games. Intentionally empty in the
// foundation phase — the games are registered and fully wired (see
// gameTypes.js), and simply report themselves as "coming soon" until a bank
// holds enough questions. Adding content later needs no engine, API or UI
// change: push items here and the game becomes playable.
//
// Item shape (the correct answer is stored separately from the three
// distractors, so option order is shuffled per attempt, never authored):
//
//   { prompt: "Choose the correct word: She ___ to school.",
//     answer: "goes",
//     wrong: ["go", "going", "gone"] }

const englishWordBank = [];
const englishConversionBank = [];

module.exports = { englishWordBank, englishConversionBank };
