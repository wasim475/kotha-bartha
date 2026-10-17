const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeCourseQuestion, gradeCourseAnswer, selectThreeQuestions,
  passedScore, requiresReread, REREAD_AFTER_MS,
} = require("../../src/utils/courseTestPolicy");

test("normalizes each supported question type and comma-separated answer alternatives", () => {
  const mcq = normalizeCourseQuestion({ type: "mcq", prompt: "Pick", options: [{ text: "A", correct: true }, { text: "B" }] });
  assert.equal(mcq.question.options.filter((option) => option.correct).length, 1);
  const short = normalizeCourseQuestion({ type: "short_answer", prompt: "Fill", acceptedAnswers: " in, , ON  the   bus, in " });
  assert.deepEqual(short.question.acceptedAnswers, ["in", "ON the bus"]);
  const sentence = normalizeCourseQuestion({ type: "sentence", prompt: "Write", acceptedAnswers: [" She is here "] });
  assert.equal(sentence.question.acceptedAnswers[0], "She is here");
  assert.match(normalizeCourseQuestion({ type: "mcq", prompt: "Bad", options: [{ text: "A" }, { text: "A", correct: true }] }).error, /unique/);
});

test("grades MCQ and text answers with multiple-correct and normalized alternatives", () => {
  const multi = { type: "mcq", options: [{ text: "one", correct: true }, { text: "two", correct: true }, { text: "three", correct: false }] };
  assert.deepEqual(gradeCourseAnswer(multi, { selectedOptions: ["one", "two"] }), { correct: true });
  assert.deepEqual(gradeCourseAnswer(multi, { selectedOptions: ["one"] }), { correct: false });
  const text = { type: "short_answer", acceptedAnswers: ["on the bus", "in"] };
  assert.deepEqual(gradeCourseAnswer(text, { text: "  ON   THE bus " }), { correct: true });
  assert.deepEqual(gradeCourseAnswer(text, { text: "on bus" }), { correct: false });
  assert.equal(gradeCourseAnswer(multi, { selectedOptions: ["not an option"] }).error, "Choose options from the current test.");
});

test("selects exactly three unique questions and avoids the previous attempt when possible", () => {
  const questions = Array.from({ length: 6 }, (_, index) => ({ _id: `q${index}`, type: "short_answer", prompt: `Q${index}`, acceptedAnswers: [`${index}`] }));
  const first = selectThreeQuestions(questions, [], (max) => max - 1);
  assert.equal(first.length, 3);
  assert.equal(new Set(first.map((question) => String(question.questionId))).size, 3);
  const next = selectThreeQuestions(questions, first.map((question) => question.questionId), (max) => max - 1);
  assert.equal(next.length, 3);
  assert.equal(next.some((question) => first.some((prior) => String(prior.questionId) === String(question.questionId))), false);
  assert.equal(selectThreeQuestions(questions.slice(0, 2)), null);
});

test("enforces 2 of 3 and requires rereading after five minutes", () => {
  assert.equal(passedScore(1), false);
  assert.equal(passedScore(2), true);
  const attempt = new Date("2026-01-01T00:00:00Z");
  assert.equal(requiresReread(attempt, attempt, attempt.getTime() + REREAD_AFTER_MS - 1), false);
  assert.equal(requiresReread(attempt, attempt, attempt.getTime() + REREAD_AFTER_MS), true);
  assert.equal(requiresReread(new Date(attempt.getTime() + REREAD_AFTER_MS), attempt, attempt.getTime() + REREAD_AFTER_MS), false);
});
