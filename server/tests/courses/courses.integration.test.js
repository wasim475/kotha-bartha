const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const http = require("node:http");
const mongoose = require("mongoose");
const coursesRouter = require("../../src/routes/courses.routes");
const CourseSubject = require("../../src/models/CourseSubject");
const Course = require("../../src/models/Course");
const CourseSection = require("../../src/models/CourseSection");
const CourseLesson = require("../../src/models/CourseLesson");
const CourseLessonProgress = require("../../src/models/CourseLessonProgress");

// This suite never falls back to MONGODB_URI. The opt-in URI must name a test DB.
const testUri = process.env.COURSES_TEST_MONGODB_URI || "";
let safeTestUri = false;
try {
  const parsed = new URL(testUri);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  const localMongoHost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  safeTestUri = /^mongodb(?:\+srv)?:$/.test(parsed.protocol) && localMongoHost && /(?:^|[-_])test(?:$|[-_])/i.test(databaseName);
} catch { /* Missing or invalid opt-in URI means a safe skip. */ }

test("Courses API integration: CRUD, ordering, publication and roles", { skip: !safeTestUri && "Set COURSES_TEST_MONGODB_URI to an isolated database whose name includes test." }, async (t) => {
  const app = express();
  app.use(express.json());
  const authorId = new mongoose.Types.ObjectId();
  // Test-only stand-in for requireAuth; the Courses router still enforces its role middleware.
  app.use((req, res, next) => {
    req.user = { _id: req.get("x-test-user") || authorId, role: req.get("x-test-role") || "user" };
    next();
  });
  app.use(coursesRouter);
  const server = http.createServer(app);
  const owned = { subjects: [], courses: [], sections: [], lessons: [] };
  let base;
  let connected = false;

  const request = async (method, path, role = "user", body, userId = authorId) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json", "x-test-role": role, "x-test-user": String(userId) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };
  const remember = (collection, response) => {
    assert.ok(response.body.data?._id, JSON.stringify(response.body));
    owned[collection].push(response.body.data._id);
    return response.body.data;
  };

  try {
    await mongoose.connect(testUri);
    connected = true;
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${server.address().port}`;

    const deniedSubject = await request("POST", "/staff/courses/subjects", "moderator", { title: "Forbidden subject" });
    assert.equal(deniedSubject.status, 403);
    const deniedStaffList = await request("GET", "/staff/courses", "user");
    assert.equal(deniedStaffList.status, 403);

    const subject = remember("subjects", await request("POST", "/staff/courses/subjects", "admin", { title: `Courses test ${Date.now()}`, order: 4 }));
    const course = remember("courses", await request("POST", "/staff/courses/courses", "moderator", { title: "Test course", subjectId: subject._id, order: 5 }));
    const section = remember("sections", await request("POST", "/staff/courses/sections", "moderator", { title: "First section", courseId: course._id, order: 6 }));
    const lessonOne = remember("lessons", await request("POST", "/staff/courses/lessons", "moderator", { title: "First lesson", courseId: course._id, sectionId: section._id, order: 8, blocks: [{ type: "text", text: "First" }] }));
    const lessonTwo = remember("lessons", await request("POST", "/staff/courses/lessons", "moderator", { title: "Second lesson", courseId: course._id, sectionId: section._id, order: 2, blocks: [{ type: "text", text: "Before table" }, { type: "table", rows: [["Head", "Value"], ["A", "1"]], firstRowHeader: true }, { type: "divider" }, { type: "text", text: "After table" }] }));

    assert.equal((await request("GET", `/courses/${course._id}`)).status, 404, "draft course is hidden");
    assert.equal((await request("GET", `/courses/lessons/${lessonOne._id}`)).status, 404, "draft lesson is hidden");
    assert.equal((await request("GET", "/courses/lessons/not-an-object-id")).status, 400, "invalid lesson IDs are rejected before lookup");
    assert.equal((await request("PATCH", `/staff/courses/lessons/${lessonOne._id}`, "user", { title: "Intrusion" })).status, 403);
    assert.equal((await request("POST", "/staff/courses/lessons", "moderator", { title: "Unsafe", courseId: course._id, sectionId: section._id, blocks: [{ type: "video", url: "https://evil.example/embed/x" }] })).status, 400);
    assert.equal((await request("POST", "/staff/courses/lessons", "moderator", { title: "Unsafe link", courseId: course._id, sectionId: section._id, blocks: [{ type: "text", text: "[unsafe](javascript:alert(1))" }] })).status, 400);
    assert.equal((await request("POST", "/staff/courses/lessons", "moderator", { title: "Invalid table", courseId: course._id, sectionId: section._id, blocks: [{ type: "table", rows: [["one"], ["two", "extra"]] }] })).status, 400);

    assert.equal((await request("PATCH", `/staff/courses/courses/${course._id}`, "moderator", { title: "Published test course", order: 1, status: "published" })).status, 200);
    assert.equal((await request("PATCH", `/staff/courses/lessons/${lessonOne._id}`, "moderator", { title: "Edited first lesson", order: 1, status: "published", blocks: [{ type: "text", text: "Updated" }] })).status, 200);
    assert.equal((await request("PATCH", `/staff/courses/lessons/${lessonTwo._id}`, "moderator", { order: 0, status: "published" })).status, 200);
    assert.equal((await request("PATCH", `/staff/courses/lessons/${lessonTwo._id}`, "moderator", { blocks: [{ type: "text", text: "Before" }, { type: "table", rows: [["Column", "Value"], ["Term", "Edited"]], firstRowHeader: true }, { type: "divider" }, { type: "text", text: "After" }] })).status, 200);
    assert.equal((await request("PATCH", `/staff/courses/sections/${section._id}`, "moderator", { title: "Edited section", order: 0, visible: true })).status, 200);

    const publicCourse = await request("GET", `/courses/${course._id}`);
    assert.equal(publicCourse.status, 200);
    assert.deepEqual(publicCourse.body.data.sections[0].lessons.map((lesson) => lesson.title), ["Second lesson", "Edited first lesson"]);
    const publicTableLesson = await request("GET", `/courses/lessons/${lessonTwo._id}`);
    assert.deepEqual(publicTableLesson.body.data.lesson.blocks.map((block) => block.type), ["text", "table", "divider", "text"]);
    assert.deepEqual(publicTableLesson.body.data.lesson.blocks[1].rows, [["Column", "Value"], ["Term", "Edited"]]);
    const publicLesson = await request("GET", `/courses/lessons/${lessonOne._id}`);
    assert.equal(publicLesson.status, 200);
    assert.equal(publicLesson.body.data.lesson.blocks[0].text, "Updated");

    assert.equal((await request("PATCH", `/staff/courses/lessons/${lessonTwo._id}/test`, "moderator", { published: true })).status, 409, "a test cannot publish before it has three questions");
    const questionBank = Array.from({ length: 4 }, (_, index) => ({ type: "sentence", prompt: `Question ${index + 1}`, acceptedAnswers: "yes, YES", explanation: "Answer yes." }));
    const savedQuestions = await request("POST", `/staff/courses/lessons/${lessonTwo._id}/questions`, "moderator", { questions: questionBank });
    assert.equal(savedQuestions.status, 201, "bulk creation saves a question bank");
    const questionIds = savedQuestions.body.data.questions.map((question) => question._id);
    const otherModerator = new mongoose.Types.ObjectId();
    assert.equal((await request("GET", `/staff/courses/lessons/${lessonTwo._id}/questions`, "moderator", undefined, otherModerator)).status, 403, "moderators cannot view another author's lesson questions");
    assert.equal((await request("PATCH", `/staff/courses/questions/${questionIds[0]}`, "moderator", { prompt: "Intrusion" }, otherModerator)).status, 403, "moderators cannot edit another author's question");
    assert.equal((await request("GET", `/staff/courses/lessons/${lessonTwo._id}/questions`, "admin", undefined, otherModerator)).status, 200, "admins can manage every lesson");
    assert.equal((await request("PATCH", `/staff/courses/questions/${questionIds[0]}`, "moderator", { prompt: "Edited question" })).status, 200, "lesson author can edit a question");
    assert.equal((await request("PATCH", `/staff/courses/questions/${questionIds[0]}`, "moderator", { order: 99 })).status, 200, "lesson author can reorder a question");
    assert.equal((await request("GET", `/staff/courses/lessons/${lessonTwo._id}/questions`, "moderator")).body.data.questions.find((question) => question._id === questionIds[0]).order, 99);
    assert.equal((await request("GET", `/courses/lessons/${lessonTwo._id}/test`)).body.data.state, "unavailable", "unpublished test is hidden from learners");
    assert.equal((await request("PATCH", `/staff/courses/lessons/${lessonTwo._id}/test`, "moderator", { published: true })).status, 200);
    assert.equal((await request("POST", `/courses/lessons/${lessonTwo._id}/test/start`)).status, 409, "test requires lesson-read acknowledgement");
    await request("POST", `/courses/lessons/${lessonTwo._id}/read`);
    const firstAttempt = await request("POST", `/courses/lessons/${lessonTwo._id}/test/start`);
    assert.equal(firstAttempt.status, 201);
    assert.equal(firstAttempt.body.data.questions.length, 3);
    assert.equal(new Set(firstAttempt.body.data.questions.map((question) => question.questionId)).size, 3);
    assert.equal(firstAttempt.body.data.questions.some((question) => "acceptedAnswers" in question || "correct" in question), false, "attempt questions never disclose answer keys");
    assert.equal((await request("POST", `/courses/lessons/${lessonTwo._id}/test/submit`, "user", { attemptId: firstAttempt.body.data.attemptId, answers: [] }, otherModerator)).status, 404, "attempts are private to their learner");
    const firstAnswers = firstAttempt.body.data.questions.map((question, index) => ({ questionId: question.questionId, text: index === 0 ? "yes" : "no" }));
    const failed = await request("POST", `/courses/lessons/${lessonTwo._id}/test/submit`, "user", { attemptId: firstAttempt.body.data.attemptId, score: 3, answers: firstAnswers });
    assert.equal(failed.body.data.score, 1, "server ignores forged client scores");
    assert.equal((await request("POST", `/courses/lessons/${lessonTwo._id}/test/submit`, "user", { attemptId: firstAttempt.body.data.attemptId, answers: firstAnswers })).status, 409, "completed attempts cannot be submitted twice");
    await request("POST", `/courses/lessons/${lessonOne._id}/read`);
    assert.equal((await request("GET", `/courses/lessons/${lessonOne._id}/test`)).body.data.state, "locked", "next lesson remains locked after a failed score");
    const retryAttempt = await request("POST", `/courses/lessons/${lessonTwo._id}/test/start`);
    assert.equal(retryAttempt.status, 201, "immediate retries are allowed");
    const retryAnswers = retryAttempt.body.data.questions.map((question, index) => ({ questionId: question.questionId, text: index < 2 ? " YES " : "no" }));
    const passed = await request("POST", `/courses/lessons/${lessonTwo._id}/test/submit`, "user", { attemptId: retryAttempt.body.data.attemptId, score: 0, answers: retryAnswers });
    assert.equal(passed.body.data.score, 2);
    assert.equal(passed.body.data.passed, true);
    assert.equal(passed.body.data.feedback[0].correctAnswers[0], "yes");
    assert.equal((await request("GET", `/courses/lessons/${lessonOne._id}/test`)).body.data.state, "available", "2/3 unlocks the next test");
    await CourseLessonProgress.updateOne({ userId: authorId, lessonId: lessonTwo._id }, { $set: { lastAttemptAt: new Date(Date.now() - 6 * 60 * 1000) } });
    assert.equal((await request("GET", `/courses/lessons/${lessonTwo._id}/test`)).body.data.state, "reread_required");
    assert.equal((await request("POST", `/courses/lessons/${lessonTwo._id}/test/start`)).status, 409, "five-minute rereading rule is enforced by the server");
    await request("POST", `/courses/lessons/${lessonTwo._id}/read`);
    assert.equal((await request("GET", `/courses/lessons/${lessonTwo._id}/test`)).body.data.state, "passed", "reading again clears the retry gate");
    assert.equal((await request("PATCH", `/staff/courses/lessons/${lessonTwo._id}/test`, "moderator", { published: false })).status, 200, "staff can unpublish a lesson test");
    assert.equal((await request("GET", `/courses/lessons/${lessonTwo._id}/test`)).body.data.state, "unavailable");
    assert.equal((await request("PATCH", `/staff/courses/lessons/${lessonTwo._id}/test`, "moderator", { published: true })).status, 200);
    assert.equal((await request("DELETE", `/staff/courses/questions/${questionIds[0]}`, "moderator", undefined, otherModerator)).status, 403, "moderators cannot delete another author's question");
    assert.equal((await request("DELETE", `/staff/courses/questions/${questionIds[0]}`, "moderator")).status, 200, "question deletion is available to its author");
    assert.equal((await request("DELETE", `/staff/courses/questions/${questionIds[1]}`, "moderator")).status, 200);
    assert.equal((await request("GET", `/staff/courses/lessons/${lessonTwo._id}/questions`, "admin")).body.data.testPublished, false, "deleting below three questions unpublishes the test");
    assert.equal((await request("GET", `/courses/lessons/${lessonTwo._id}/test`)).body.data.state, "unavailable", "underfilled tests remain inaccessible");

    assert.equal((await request("PATCH", `/staff/courses/courses/${course._id}`, "moderator", { status: "draft" })).status, 200);
    assert.equal((await request("GET", `/courses/${course._id}`)).status, 404, "unpublished course is hidden");
    assert.equal((await request("PATCH", `/staff/courses/courses/${course._id}`, "moderator", { status: "published" })).status, 200);
    assert.equal((await request("PATCH", `/staff/courses/sections/${section._id}`, "moderator", { visible: false })).status, 200);
    assert.equal((await request("GET", `/courses/${course._id}`)).body.data.sections.length, 0, "hidden section is omitted");
    assert.equal((await request("PATCH", `/staff/courses/sections/${section._id}`, "moderator", { visible: true })).status, 200);

    assert.equal((await request("PATCH", `/staff/courses/lessons/${lessonOne._id}`, "moderator", { status: "draft" })).status, 200);
    assert.equal((await request("GET", `/courses/lessons/${lessonOne._id}`)).status, 404, "unpublished lesson is hidden immediately");
    assert.equal((await request("DELETE", `/staff/courses/subjects/${subject._id}`, "admin")).status, 409, "subject with a course cannot be deleted");

    assert.equal((await request("DELETE", `/staff/courses/lessons/${lessonTwo._id}`, "moderator")).status, 200);
    owned.lessons = owned.lessons.filter((id) => id !== lessonTwo._id);
    assert.equal((await request("DELETE", `/staff/courses/sections/${section._id}`, "moderator")).status, 200);
    owned.sections = owned.sections.filter((id) => id !== section._id);
    owned.lessons = [];
    assert.equal((await request("DELETE", `/staff/courses/courses/${course._id}`, "moderator")).status, 200);
    owned.courses = owned.courses.filter((id) => id !== course._id);
    owned.lessons = []; owned.sections = [];
    assert.equal((await request("DELETE", `/staff/courses/subjects/${subject._id}`, "admin")).status, 200);
    owned.subjects = owned.subjects.filter((id) => id !== subject._id);
    await t.test("fixture reached and cleaned through the CRUD workflow", () => assert.equal(true, true));
  } finally {
    if (connected) {
      await CourseLesson.deleteMany({ _id: { $in: owned.lessons } });
      await CourseSection.deleteMany({ _id: { $in: owned.sections } });
      await Course.deleteMany({ _id: { $in: owned.courses } });
      await CourseSubject.deleteMany({ _id: { $in: owned.subjects } });
      await mongoose.disconnect();
    }
    if (server.listening) await new Promise((resolve) => server.close(resolve));
  }
});
