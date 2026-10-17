const { randomInt } = require("node:crypto");

const PASS_SCORE = 2;
const REREAD_AFTER_MS = 5 * 60 * 1000;
const QUESTION_TYPES = new Set(["mcq", "short_answer", "sentence"]);
const normalizeAnswer = (value) => String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();

function normalizeCourseQuestion(input) {
  const question = input || {};
  const type = question.type;
  const prompt = String(question.prompt || "").trim();
  if (!QUESTION_TYPES.has(type) || !prompt || prompt.length > 1000) return { error: "Choose a supported question type and enter question text." };
  const explanation = String(question.explanation || "").trim().slice(0, 1000);
  const order = question.order === undefined ? 0 : question.order;
  if (!Number.isInteger(order) || order < 0 || order > 10000) return { error: "Question order must be between 0 and 10000." };
  if (type === "mcq") {
    if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 10) return { error: "MCQs need 2 to 10 options." };
    const options = question.options.map((option) => ({ text: String(option?.text || "").trim(), correct: option?.correct === true }));
    if (options.some((option) => !option.text || option.text.length > 500) || new Set(options.map((option) => normalizeAnswer(option.text))).size !== options.length) return { error: "MCQ options must be nonempty and unique." };
    if (!options.some((option) => option.correct)) return { error: "Mark at least one MCQ option as correct." };
    return { question: { type, prompt, options, acceptedAnswers: [], explanation, order } };
  }
  const rawAnswers = Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : String(question.acceptedAnswers || "").split(",");
  const acceptedAnswers = [...new Set(rawAnswers.map((answer) => String(answer || "").trim().replace(/\s+/g, " ")).filter(Boolean))];
  if (!acceptedAnswers.length || acceptedAnswers.length > 20 || acceptedAnswers.some((answer) => answer.length > 500)) return { error: "Enter 1 to 20 accepted answers, each 500 characters or fewer." };
  return { question: { type, prompt, options: [], acceptedAnswers, explanation, order } };
}

function shuffle(items, random = randomInt) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = random(index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function selectThreeQuestions(questions, recentQuestionIds = [], random = randomInt) {
  if (questions.length < 3) return null;
  const recent = new Set(recentQuestionIds.map(String));
  const unused = questions.filter((question) => !recent.has(String(question._id)));
  const selected = shuffle(unused, random).slice(0, 3);
  if (selected.length < 3) {
    const selectedIds = new Set(selected.map((question) => String(question._id)));
    selected.push(...shuffle(questions.filter((question) => !selectedIds.has(String(question._id))), random).slice(0, 3 - selected.length));
  }
  return shuffle(selected, random).map((question) => ({
    questionId: question._id,
    type: question.type,
    prompt: question.prompt,
    options: question.type === "mcq" ? shuffle(question.options, random).map((option) => ({ text: option.text, correct: option.correct })) : [],
    acceptedAnswers: [...question.acceptedAnswers],
    explanation: question.explanation || "",
  }));
}

function gradeCourseAnswer(question, answer) {
  if (question.type === "mcq") {
    const selected = Array.isArray(answer?.selectedOptions) ? answer.selectedOptions.map(normalizeAnswer).filter(Boolean) : [];
    const expected = question.options.filter((option) => option.correct).map((option) => normalizeAnswer(option.text));
    if (selected.some((value) => !question.options.some((option) => normalizeAnswer(option.text) === value))) return { error: "Choose options from the current test." };
    return { correct: selected.length === expected.length && new Set(selected).size === selected.length && selected.every((value) => expected.includes(value)) };
  }
  if (typeof answer?.text !== "string") return { error: "Enter a text answer." };
  const submitted = normalizeAnswer(answer.text);
  return { correct: question.acceptedAnswers.some((expected) => normalizeAnswer(expected) === submitted) };
}

function requiresReread(lastReadAt, lastAttemptAt, now = Date.now()) {
  if (!lastAttemptAt) return false;
  const attemptedAt = new Date(lastAttemptAt).getTime();
  const readAt = lastReadAt ? new Date(lastReadAt).getTime() : 0;
  return now - attemptedAt >= REREAD_AFTER_MS && readAt <= attemptedAt;
}

function passedScore(score) { return score >= PASS_SCORE; }

module.exports = { PASS_SCORE, QUESTION_TYPES, REREAD_AFTER_MS, gradeCourseAnswer, normalizeAnswer, normalizeCourseQuestion, passedScore, requiresReread, selectThreeQuestions, shuffle };
