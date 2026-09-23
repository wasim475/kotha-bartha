// Splits one large pasted block containing many questions into individual
// question blocks, then runs the existing single-question parser
// (parsePastedQuestion.js) on each — so bulk parsing shares exactly the
// same marker/correct-answer detection as the single-question form's smart
// paste, rather than a second, parallel implementation.
import { markerLetter, MARKER_LINE_REGEX, parsePastedQuestion } from "./parsePastedQuestion";

// An optional "প্রশ্ন ১:" / "Question 2." label line some pasted sets
// include before each question — recognized and dropped (or, if the
// question text follows on the same line, just that prefix is stripped)
// since it's not part of the question itself. Bengali digits (০-৯) and
// ASCII digits are both accepted.
const QUESTION_LABEL_LINE = /^(প্রশ্ন|question)\s*[\d০-৯]*\s*[:.।]?\s*$/i;
const QUESTION_LABEL_INLINE = /^\s*(প্রশ্ন|question)\s*[\d০-৯]*\s*[:.।]\s*(.+)$/i;

function stripQuestionLabel(blockText) {
  const lines = blockText.split("\n");
  let index = 0;
  while (index < lines.length && !lines[index].trim()) index++;
  if (index >= lines.length) return blockText;

  const trimmed = lines[index].trim();
  if (QUESTION_LABEL_LINE.test(trimmed)) {
    lines.splice(index, 1);
    return lines.join("\n");
  }
  const inline = lines[index].match(QUESTION_LABEL_INLINE);
  if (inline) {
    lines[index] = inline[2];
    return lines.join("\n");
  }
  return blockText;
}

// A new question starts at the first non-blank line that follows a
// completed "D"/"ঘ" option — whatever that line is (a "প্রশ্ন N:" label,
// the next question's own text, or straight into its "A)"/"ক)" marker).
// Splitting on "any content after D" rather than only "the next A marker"
// matters: the label line and question text that come between one
// question's last option and the next one's first marker would otherwise
// get appended to the wrong (preceding) block instead of starting a new
// one.
function splitIntoBlocks(rawText) {
  const lines = String(rawText || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let current = [];
  let sawD = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed && sawD) {
      blocks.push(current);
      current = [];
      sawD = false;
    }
    if (trimmed) {
      const match = trimmed.match(MARKER_LINE_REGEX);
      if (match && markerLetter(match[1]) === "D") sawD = true;
    }
    current.push(rawLine);
  }
  if (current.some((line) => line.trim())) blocks.push(current);

  return blocks.map((lines2) => lines2.join("\n"));
}

// Returns { questions, errors, total } where:
//   questions — array of { question, options: [A,B,C,D], correctIndex }
//               for every block that parsed cleanly
//   errors    — array of { index, message } (1-based `index` matches the
//               question's position in the pasted text) for every block
//               that didn't
//   total     — how many question blocks were detected in total
export function parseBulkQuestions(rawText) {
  const blocks = splitIntoBlocks(rawText).map(stripQuestionLabel);
  const questions = [];
  const errors = [];

  blocks.forEach((block, blockIndex) => {
    if (!block.trim()) return;
    const position = blockIndex + 1;
    const result = parsePastedQuestion(block);

    if (!result.ok) {
      if (result.reason === "no-options") {
        errors.push({ index: position, message: "No options detected." });
      } else {
        errors.push({ index: position, message: `Only ${result.count} option${result.count === 1 ? "" : "s"} found — need exactly 4.` });
      }
      return;
    }
    if (result.multipleCorrect) {
      errors.push({ index: position, message: "Duplicate correct-answer markers — mark exactly one option." });
      return;
    }
    if (!result.correctAnswer) {
      errors.push({ index: position, message: "No correct answer marked." });
      return;
    }
    if (!result.question) {
      errors.push({ index: position, message: "Question text is empty." });
      return;
    }

    questions.push({
      question: result.question,
      options: ["A", "B", "C", "D"].map((letter) => result.options[letter]),
      correctIndex: ["A", "B", "C", "D"].indexOf(result.correctAnswer),
    });
  });

  return { questions, errors, total: blocks.filter((block) => block.trim()).length };
}
