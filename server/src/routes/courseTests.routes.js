const express = require("express");
const mongoose = require("mongoose");
const { requireRole } = require("../middleware/requireRole");
const Course = require("../models/Course");
const CourseSection = require("../models/CourseSection");
const CourseLesson = require("../models/CourseLesson");
const CourseLessonQuestion = require("../models/CourseLessonQuestion");
const CourseLessonAttempt = require("../models/CourseLessonAttempt");
const CourseLessonProgress = require("../models/CourseLessonProgress");
const { normalizeCourseQuestion, selectThreeQuestions, gradeCourseAnswer, passedScore, requiresReread } = require("../utils/courseTestPolicy");

const router = express.Router();
const staff = requireRole("admin", "moderator");
const idValid = (value) => mongoose.isValidObjectId(value);
const failure = (res, status, code, message, extra = {}) => res.status(status).json({ error: { code, message, ...extra } });

async function staffLesson(req, res, lessonId) {
  if (!idValid(lessonId)) { failure(res, 400, "VALIDATION_ERROR", "Invalid lesson ID."); return null; }
  const lesson = await CourseLesson.findById(lessonId);
  if (!lesson) { failure(res, 404, "NOT_FOUND", "Lesson not found."); return null; }
  if (req.user.role !== "admin" && String(lesson.authorId) !== String(req.user._id)) {
    failure(res, 403, "FORBIDDEN", "Moderators can manage questions only for lessons they created."); return null;
  }
  return lesson;
}

async function learnerLesson(lessonId) {
  if (!idValid(lessonId)) return null;
  const lesson = await CourseLesson.findOne({ _id: lessonId, status: "published" }).lean();
  if (!lesson) return null;
  const [course, section] = await Promise.all([
    Course.findOne({ _id: lesson.courseId, status: "published" }).lean(),
    CourseSection.findOne({ _id: lesson.sectionId, courseId: lesson.courseId, visible: true }).lean(),
  ]);
  return course && section ? { lesson, course, section } : null;
}

async function testState(userId, context, now = Date.now()) {
  const { lesson, course } = context;
  if (!lesson.testPublished) return { state: "unavailable", canStart: false, questionsNeeded: null };
  const sections = await CourseSection.find({ courseId: course._id, visible: true }).select("_id order").lean();
  const sectionOrder = new Map(sections.map((section) => [String(section._id), section.order]));
  const lessons = await CourseLesson.find({ courseId: course._id, status: "published", sectionId: { $in: sections.map((section) => section._id) } }).select("_id sectionId order testPublished").lean();
  lessons.sort((a, b) => (sectionOrder.get(String(a.sectionId)) - sectionOrder.get(String(b.sectionId))) || a.order - b.order || String(a._id).localeCompare(String(b._id)));
  const previous = lessons[lessons.findIndex((item) => String(item._id) === String(lesson._id)) - 1];
  if (previous) {
    const previousProgress = await CourseLessonProgress.findOne({ userId, lessonId: previous._id, passedAt: { $ne: null } }).lean();
    if (!previous.testPublished || !previousProgress) return { state: "locked", canStart: false, questionsNeeded: null };
  }
  const [questionCount, progress, lastAttempt] = await Promise.all([
    CourseLessonQuestion.countDocuments({ lessonId: lesson._id }),
    CourseLessonProgress.findOne({ userId, lessonId: lesson._id }).lean(),
    CourseLessonAttempt.findOne({ userId, lessonId: lesson._id, status: "completed" }).sort({ createdAt: -1 }).select("score passed createdAt").lean(),
  ]);
  if (questionCount < 3) return { state: "insufficient_questions", canStart: false, questionsNeeded: 3 - questionCount };
  const passedBefore = Boolean(progress?.passedAt);
  if (requiresReread(progress?.lastReadAt, progress?.lastAttemptAt, now)) return { state: "reread_required", canStart: false, questionsNeeded: 0, passedBefore, rereadAfter: new Date(new Date(progress.lastAttemptAt).getTime() + 5 * 60 * 1000) };
  if (passedBefore) return { state: "passed", canStart: true, questionsNeeded: 0, score: lastAttempt?.score ?? null, passedAt: progress.passedAt };
  if (!progress?.lastReadAt) return { state: "unread", canStart: false, questionsNeeded: 0 };
  return { state: "available", canStart: true, questionsNeeded: 0, score: lastAttempt?.score ?? null };
}

function safeAttempt(attempt) {
  return {
    attemptId: attempt._id,
    questions: attempt.questions.map((question) => ({
      questionId: question.questionId,
      type: question.type,
      prompt: question.prompt,
      options: question.options.map((option) => option.text),
    })),
  };
}

router.get("/staff/courses/lessons/:lessonId/questions", staff, async (req, res, next) => {
  try {
    const lesson = await staffLesson(req, res, req.params.lessonId);
    if (!lesson) return;
    const questions = await CourseLessonQuestion.find({ lessonId: lesson._id }).sort({ order: 1, _id: 1 }).lean();
    res.json({ data: { questions, testPublished: lesson.testPublished, lessonStatus: lesson.status } });
  } catch (error) { next(error); }
});

router.post("/staff/courses/lessons/:lessonId/questions", staff, async (req, res, next) => {
  try {
    const lesson = await staffLesson(req, res, req.params.lessonId);
    if (!lesson) return;
    const input = req.body?.questions;
    if (!Array.isArray(input) || !input.length || input.length > 50) return failure(res, 400, "VALIDATION_ERROR", "Add between 1 and 50 questions.");
    const normalized = input.map(normalizeCourseQuestion);
    const invalid = normalized.find((entry) => entry.error);
    if (invalid) return failure(res, 400, "VALIDATION_ERROR", invalid.error);
    const last = await CourseLessonQuestion.findOne({ lessonId: lesson._id }).sort({ order: -1 }).select("order").lean();
    const created = await CourseLessonQuestion.create(normalized.map((entry, index) => ({ ...entry.question, lessonId: lesson._id, order: last ? last.order + index + 1 : index })));
    res.status(201).json({ data: { questions: created } });
  } catch (error) { next(error); }
});

router.patch("/staff/courses/lessons/:lessonId/test", staff, async (req, res, next) => {
  try {
    const lesson = await staffLesson(req, res, req.params.lessonId);
    if (!lesson) return;
    if (typeof req.body?.published !== "boolean") return failure(res, 400, "VALIDATION_ERROR", "Set published to true or false.");
    if (req.body.published) {
      if (lesson.status !== "published") return failure(res, 409, "LESSON_UNPUBLISHED", "Publish the lesson before publishing its test.");
      const count = await CourseLessonQuestion.countDocuments({ lessonId: lesson._id });
      if (count < 3) return failure(res, 409, "QUESTIONS_REQUIRED", "A test needs at least 3 valid questions.", { questionsNeeded: 3 - count });
    }
    lesson.testPublished = req.body.published;
    await lesson.save();
    res.json({ data: { published: lesson.testPublished } });
  } catch (error) { next(error); }
});

router.patch("/staff/courses/questions/:questionId", staff, async (req, res, next) => {
  try {
    if (!idValid(req.params.questionId)) return failure(res, 400, "VALIDATION_ERROR", "Invalid question ID.");
    const existing = await CourseLessonQuestion.findById(req.params.questionId);
    if (!existing) return failure(res, 404, "NOT_FOUND", "Question not found.");
    const lesson = await staffLesson(req, res, existing.lessonId);
    if (!lesson) return;
    const normalized = normalizeCourseQuestion({ ...existing.toObject(), ...req.body });
    if (normalized.error) return failure(res, 400, "VALIDATION_ERROR", normalized.error);
    existing.set(normalized.question);
    await existing.save();
    res.json({ data: existing });
  } catch (error) { next(error); }
});

router.delete("/staff/courses/questions/:questionId", staff, async (req, res, next) => {
  try {
    if (!idValid(req.params.questionId)) return failure(res, 400, "VALIDATION_ERROR", "Invalid question ID.");
    const question = await CourseLessonQuestion.findById(req.params.questionId);
    if (!question) return failure(res, 404, "NOT_FOUND", "Question not found.");
    const lesson = await staffLesson(req, res, question.lessonId);
    if (!lesson) return;
    await CourseLessonQuestion.findByIdAndDelete(question._id);
    if (lesson.testPublished && await CourseLessonQuestion.countDocuments({ lessonId: lesson._id }) < 3) {
      lesson.testPublished = false;
      await lesson.save();
    }
    res.json({ data: { deleted: true } });
  } catch (error) { next(error); }
});

router.post("/courses/lessons/:lessonId/read", async (req, res, next) => {
  try {
    const context = await learnerLesson(req.params.lessonId);
    if (!context) return failure(res, 404, "NOT_FOUND", "Lesson not found.");
    const progress = await CourseLessonProgress.findOneAndUpdate(
      { userId: req.user._id, lessonId: context.lesson._id },
      { $set: { lastReadAt: new Date() } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    res.json({ data: { readAt: progress.lastReadAt } });
  } catch (error) { next(error); }
});

router.get("/courses/lessons/:lessonId/test", async (req, res, next) => {
  try {
    const context = await learnerLesson(req.params.lessonId);
    if (!context) return failure(res, 404, "NOT_FOUND", "Lesson test not found.");
    const state = await testState(req.user._id, context);
    res.json({ data: state });
  } catch (error) { next(error); }
});

router.post("/courses/lessons/:lessonId/test/start", async (req, res, next) => {
  try {
    const context = await learnerLesson(req.params.lessonId);
    if (!context) return failure(res, 404, "NOT_FOUND", "Lesson test not found.");
    const state = await testState(req.user._id, context);
    if (!state.canStart) {
      const messages = {
        unavailable: [404, "NOT_FOUND", "This lesson test is not published."],
        locked: [403, "TEST_LOCKED", "Pass the previous lesson test to unlock this one."],
        insufficient_questions: [409, "QUESTIONS_NEEDED", `This test needs ${state.questionsNeeded} more question${state.questionsNeeded === 1 ? "" : "s"}.`],
        unread: [409, "READ_REQUIRED", "Read the whole lesson before starting its test."],
        reread_required: [409, "REREAD_REQUIRED", "Please reread the entire lesson before trying this test again."],
      };
      const [status, code, message] = messages[state.state] || [409, "TEST_UNAVAILABLE", "This test is not available yet."];
      return failure(res, status, code, message, { questionsNeeded: state.questionsNeeded, rereadAfter: state.rereadAfter });
    }
    const active = await CourseLessonAttempt.findOne({ userId: req.user._id, lessonId: context.lesson._id, status: "in_progress" }).sort({ createdAt: -1 });
    if (active && Date.now() - active.createdAt.getTime() < 30 * 60 * 1000) return res.json({ data: safeAttempt(active) });
    if (active) { active.status = "expired"; await active.save(); }
    const questions = await CourseLessonQuestion.find({ lessonId: context.lesson._id }).sort({ order: 1, _id: 1 }).lean();
    const lastAttempt = await CourseLessonAttempt.findOne({ userId: req.user._id, lessonId: context.lesson._id, status: { $in: ["completed", "expired"] } }).sort({ createdAt: -1 }).select("questions.questionId").lean();
    const selected = selectThreeQuestions(questions, (lastAttempt?.questions || []).map((question) => question.questionId));
    if (!selected) return failure(res, 409, "QUESTIONS_NEEDED", "This test needs at least 3 questions.", { questionsNeeded: Math.max(0, 3 - questions.length) });
    const attempt = await CourseLessonAttempt.create({ userId: req.user._id, lessonId: context.lesson._id, questions: selected });
    await CourseLessonProgress.findOneAndUpdate({ userId: req.user._id, lessonId: context.lesson._id }, { $set: { lastAttemptAt: attempt.createdAt } }, { upsert: true, setDefaultsOnInsert: true });
    res.status(201).json({ data: safeAttempt(attempt) });
  } catch (error) { next(error); }
});

router.post("/courses/lessons/:lessonId/test/submit", async (req, res, next) => {
  try {
    const context = await learnerLesson(req.params.lessonId);
    if (!context || !context.lesson.testPublished) return failure(res, 404, "NOT_FOUND", "Lesson test not found.");
    if (!idValid(req.body?.attemptId)) return failure(res, 400, "VALIDATION_ERROR", "A valid attempt ID is required.");
    const attempt = await CourseLessonAttempt.findOne({ _id: req.body.attemptId, userId: req.user._id, lessonId: context.lesson._id });
    if (!attempt) return failure(res, 404, "NOT_FOUND", "Test attempt not found.");
    if (attempt.status !== "in_progress") return failure(res, 409, "ALREADY_SUBMITTED", "This attempt has already been submitted.");
    const answers = req.body.answers;
    if (!Array.isArray(answers) || answers.length !== 3) return failure(res, 400, "VALIDATION_ERROR", "Submit one answer for each of the 3 questions.");
    const answerMap = new Map();
    for (const answer of answers) {
      if (!answer || !idValid(answer.questionId) || answerMap.has(String(answer.questionId))) return failure(res, 400, "VALIDATION_ERROR", "Answers must contain each test question exactly once.");
      answerMap.set(String(answer.questionId), answer);
    }
    if (attempt.questions.some((question) => !answerMap.has(String(question.questionId))) || [...answerMap.keys()].some((id) => !attempt.questions.some((question) => String(question.questionId) === id))) return failure(res, 400, "VALIDATION_ERROR", "Answers must contain each test question exactly once.");
    const feedback = [];
    for (const question of attempt.questions) {
      const answer = answerMap.get(String(question.questionId));
      const grade = gradeCourseAnswer(question, answer);
      if (grade.error) return failure(res, 400, "VALIDATION_ERROR", grade.error);
      const expectedAnswers = question.type === "mcq" ? question.options.filter((option) => option.correct).map((option) => option.text) : question.acceptedAnswers;
      feedback.push({ questionId: question.questionId, correct: grade.correct, submittedAnswer: question.type === "mcq" ? answer.selectedOptions : answer.text, expectedAnswers });
    }
    const score = feedback.filter((entry) => entry.correct).length;
    const passed = passedScore(score);
    const submittedAt = new Date();
    const updatedAttempt = await CourseLessonAttempt.findOneAndUpdate(
      { _id: attempt._id, status: "in_progress" },
      { $set: { status: "completed", score, passed, feedback, submittedAt } },
      { new: true },
    );
    if (!updatedAttempt) return failure(res, 409, "ALREADY_SUBMITTED", "This attempt has already been submitted.");
    const set = { lastAttemptAt: submittedAt };
    if (passed) set.passedAt = submittedAt;
    await CourseLessonProgress.findOneAndUpdate({ userId: req.user._id, lessonId: context.lesson._id }, { $set: set }, { upsert: true, setDefaultsOnInsert: true });
    res.json({ data: {
      attemptId: attempt._id, score, total: 3, passed,
      feedback: attempt.questions.map((question) => {
        const result = feedback.find((entry) => String(entry.questionId) === String(question.questionId));
        return { questionId: question.questionId, type: question.type, prompt: question.prompt, correct: result.correct, submittedAnswer: result.submittedAnswer, correctAnswers: result.expectedAnswers, explanation: question.explanation };
      }),
    } });
  } catch (error) { next(error); }
});

module.exports = router;
