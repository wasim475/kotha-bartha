// Deterministic, local parser for "smart paste" in the Add Quiz question
// form — no AI/API call. Recognizes a question followed by four options
// marked ক)/খ)/গ)/ঘ), ক./খ./গ./ঘ., A)/B)/C)/D), or A./B./C./D. (case
// insensitive), with an optional ✅ marking the correct option.
//
// Returns either:
//   { ok: true, question, options: {A,B,C,D}, correctAnswer, multipleCorrect }
//   { ok: false, reason: "no-options" }              — no option markers found at all
//   { ok: false, reason: "wrong-count", count }       — found markers, but not exactly 4

const CHECK_MARK = "✅";
const BENGALI_MARKER_LETTER = { ক: "A", খ: "B", গ: "C", ঘ: "D" };
// A line whose trimmed start is a recognized marker + "." or ")" + optional
// whitespace, capturing the marker token and the rest of that line.
const MARKER_LINE_REGEX = /^(ক|খ|গ|ঘ|[A-Da-d])[).]\s*(.*)$/;

function markerLetter(token) {
  return BENGALI_MARKER_LETTER[token] || token.toUpperCase();
}

function stripCheckMark(text) {
  return text
    .split(CHECK_MARK)
    .join("")
    .replace(/️/g, "") // stray emoji variation selector, if present
    .replace(/\s+/g, " ")
    .trim();
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
    if (combined.includes(CHECK_MARK)) {
      correctCount += 1;
      correctAnswer = letter;
    }
    options[letter] = stripCheckMark(combined);
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
