// Deterministic, local parser for "smart paste" in the Add Quiz question
// form — no AI/API call. Recognizes a question followed by four options
// marked ক)/খ)/গ)/ঘ), ক./খ./গ./ঘ., A)/B)/C)/D), or A./B./C./D. (case
// insensitive), with the correct option marked by ✅, ✔, ✓, or [correct]
// (case insensitive) in any combination. Also used by parseBulkQuestions.js
// to parse each individual question inside a multi-question paste.
//
// Returns either:
//   { ok: true, question, options: {A,B,C,D}, correctAnswer, multipleCorrect }
//   { ok: false, reason: "no-options" }              — no option markers found at all
//   { ok: false, reason: "wrong-count", count }       — found markers, but not exactly 4

const CHECK_MARKS = ["✅", "✔", "✓"];
// Separate non-global (for a stateless .test()) and global (for
// .replace()) instances — a global regex's .test() mutates its own
// lastIndex, which would otherwise make repeated calls on this same
// module-level regex object alternate incorrectly between true/false.
const CORRECT_TEXT_MARKER_TEST = /\[correct\]/i;
const CORRECT_TEXT_MARKER_REPLACE = /\[correct\]/gi;
const BENGALI_MARKER_LETTER = { ক: "A", খ: "B", গ: "C", ঘ: "D" };
// A line whose trimmed start is a recognized marker + "." or ")" + optional
// whitespace, capturing the marker token and the rest of that line.
const MARKER_LINE_REGEX = /^(ক|খ|গ|ঘ|[A-Da-d])[).]\s*(.*)$/;

// Exported for parseBulkQuestions.js, which needs the same marker
// detection to figure out where one question ends and the next begins.
export function markerLetter(token) {
  return BENGALI_MARKER_LETTER[token] || token.toUpperCase();
}
export { MARKER_LINE_REGEX };

// Returns whether any correct-answer marker was found, and the text with
// every marker removed (never saved into the stored option text).
function extractCorrectMarker(text) {
  let found = false;
  let cleaned = text;
  for (const mark of CHECK_MARKS) {
    if (cleaned.includes(mark)) {
      found = true;
      cleaned = cleaned.split(mark).join("");
    }
  }
  if (CORRECT_TEXT_MARKER_TEST.test(cleaned)) {
    found = true;
    cleaned = cleaned.replace(CORRECT_TEXT_MARKER_REPLACE, "");
  }
  cleaned = cleaned
    .replace(/️/g, "") // stray emoji variation selector, if present
    .replace(/\s+/g, " ")
    .trim();
  return { found, cleaned };
}

export function parsePastedQuestion(rawText) {
  const lines = String(rawText || "").replace(/\r\n?/g, "\n").split("\n");

  const questionLines = [];
  const optionLines = { A: [], B: [], C: [], D: [] };
  let current = "question";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(MARKER_LINE_REGEX);
    if (match) {
      const letter = markerLetter(match[1]);
      if (optionLines[letter]) {
        current = letter;
        const rest = match[2].trim();
        if (rest) optionLines[letter].push(rest);
        continue;
      }
    }

    if (current === "question") {
      questionLines.push(line);
    } else {
      optionLines[current].push(line);
    }
  }

  const detectedLetters = ["A", "B", "C", "D"].filter((letter) => optionLines[letter].length > 0);
  if (detectedLetters.length === 0) {
    return { ok: false, reason: "no-options" };
  }
  if (detectedLetters.length !== 4) {
    return { ok: false, reason: "wrong-count", count: detectedLetters.length };
  }

  const question = questionLines.join(" ").replace(/\s+/g, " ").trim();

  const options = {};
  let correctCount = 0;
  let correctAnswer = null;
  for (const letter of ["A", "B", "C", "D"]) {
    const combined = optionLines[letter].join(" ").replace(/\s+/g, " ").trim();
    const { found, cleaned } = extractCorrectMarker(combined);
    if (found) {
      correctCount += 1;
      correctAnswer = letter;
    }
    options[letter] = cleaned;
  }

  const multipleCorrect = correctCount > 1;
  return {
    ok: true,
    question,
    options,
    correctAnswer: multipleCorrect ? null : correctCount === 1 ? correctAnswer : null,
    multipleCorrect,
  };
}
