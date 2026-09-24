// Presentation-only configuration for the Games UI.
//
// What a game actually IS — its title, category, icon glyph, question count,
// questions and scoring — comes from the server's registry via GET /games
// (see server/src/services/games/gameTypes.js), so no component here ever
// branches on a specific game type. A brand-new game type therefore shows up
// and plays with zero client changes; this file only decides how a *category*
// looks, plus the shared answer-state vocabulary and timings.

// Per-category visual tone (resolved to --tone in CSS/games.css). An unknown
// category simply falls back to the default tone.
const CATEGORY_TONES = { math: "math", english: "english" };
export const toneFor = (category) => CATEGORY_TONES[category] || "math";

// The lifecycle of ONE question on screen.
export const ANSWER_STATE = {
  PLAYING: "playing", // waiting for / accepting an answer
  CORRECT: "correct", // result shown — green
  WRONG: "wrong", // result shown — red
  TRANSITIONING: "transitioning", // fading out before the next question
};

// The result is held on screen ~1s, then the card fades out (TRANSITION_MS)
// and the next question appears — no "Next" button anywhere.
export const RESULT_HOLD_MS = 1000;
export const TRANSITION_MS = 180;

export const OPTION_LETTERS = ["A", "B", "C", "D"];

export const resultHeadline = (accuracy) => {
  if (accuracy >= 90) return "Outstanding!";
  if (accuracy >= 70) return "Great job!";
  if (accuracy >= 40) return "Good effort — go again!";
  return "Keep practicing — you'll get there!";
};
