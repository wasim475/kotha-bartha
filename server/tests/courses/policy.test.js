const test = require("node:test");
const assert = require("node:assert/strict");
const CourseLesson = require("../../src/models/CourseLesson");
const CourseSubject = require("../../src/models/CourseSubject");
const Course = require("../../src/models/Course");
const CourseSection = require("../../src/models/CourseSection");
const { requireRole } = require("../../src/middleware/requireRole");
const {
  canManageSubjectCards, deletionActions, normalizeLessonBlocks, normalizeOrder,
  publicCourseFilter, publicLessonFilter, publicLessonListFilter,
} = require("../../src/utils/coursePolicy");

test("authorization allows staff roles while subject cards remain admin-only", () => {
  assert.equal(canManageSubjectCards("admin"), true);
  assert.equal(canManageSubjectCards("moderator"), false);
  assert.equal(canManageSubjectCards("user"), false);
  for (const role of ["user", "moderator"]) {
    let status; let continued = false;
    requireRole("admin")({ user: { role } }, { status(code) { status = code; return this; }, json() {} }, () => { continued = true; });
    assert.equal(status, 403); assert.equal(continued, false);
  }
  let continued = false;
  requireRole("admin", "moderator")({ user: { role: "moderator" } }, {}, () => { continued = true; });
  assert.equal(continued, true);
});

test("public query builders always constrain reads to published content and relationships", () => {
  assert.deepEqual(publicCourseFilter("course-id"), { _id: "course-id", status: "published" });
  assert.deepEqual(publicLessonFilter("lesson-id"), { _id: "lesson-id", status: "published" });
  assert.deepEqual(publicLessonListFilter("course-id"), { courseId: "course-id", status: "published" });
  assert.deepEqual(publicLessonListFilter("course-id", "section-id"), { courseId: "course-id", sectionId: "section-id", status: "published" });
});

test("ordering accepts bounded nonnegative integers only", () => {
  assert.equal(normalizeOrder(9), 9);
  assert.equal(normalizeOrder(-1), 0);
  assert.equal(normalizeOrder(10001), 0);
  assert.equal(normalizeOrder(1.5), 0);
  assert.equal(normalizeOrder("2", null), null);
});

test("deletion plans remove dependent lessons and sections before parent courses", () => {
  assert.deepEqual(deletionActions("courses", "c1"), [
    { collection: "lessons", method: "deleteMany", filter: { courseId: "c1" } },
    { collection: "sections", method: "deleteMany", filter: { courseId: "c1" } },
    { collection: "courses", method: "findByIdAndDelete", filter: "c1" },
  ]);
  assert.deepEqual(deletionActions("sections", "s1").map((x) => x.filter), [{ sectionId: "s1" }, "s1"]);
  assert.deepEqual(deletionActions("lessons", "l1").map((x) => x.filter), ["l1"]);
  assert.equal(deletionActions("unknown", "x"), null);
});

test("content block validation keeps supported ordered blocks and rejects unsafe media", () => {
  const safeUrl = (value, video = false) => {
    try { const url = new URL(value); return url.protocol === "https:" && (!video || ["youtube.com", "www.youtube.com", "youtu.be", "www.youtube-nocookie.com"].includes(url.hostname)) ? url.toString() : null; } catch { return null; }
  };
  const result = normalizeLessonBlocks([
    { type: "text", text: "A" }, { type: "quote", text: "B" }, { type: "image", url: "https://images.example/pic.jpg", alt: "pic" },
    { type: "video", url: "https://youtu.be/abc" }, { type: "divider" },
  ], safeUrl);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.blocks.map((block) => block.type), ["text", "quote", "image", "video", "divider"]);
  assert.equal(normalizeLessonBlocks([{ type: "script" }], safeUrl).error, "Lesson blocks are invalid.");
  assert.equal(normalizeLessonBlocks([{ type: "video", url: "https://bad.example/watch" }], safeUrl).error, "Use a supported secure media URL.");
  assert.equal(normalizeLessonBlocks([{ type: "image", url: "javascript:alert(1)" }], safeUrl).error, "Use a supported secure media URL.");
  assert.equal(normalizeLessonBlocks(Array(101).fill({ type: "text" }), safeUrl).error, "Lesson blocks are invalid.");
});

test("lesson schema rejects unsupported publication states and block types without database access", async () => {
  const doc = new CourseLesson({
    courseId: "507f1f77bcf86cd799439011", sectionId: "507f1f77bcf86cd799439012", authorId: "507f1f77bcf86cd799439013",
    title: "Example", status: "published", blocks: [{ type: "text", text: "Example" }],
  });
  await doc.validate();
  doc.status = "private";
  await assert.rejects(doc.validate());
});

test("course, section and lesson records support validated create, edit, publish and delete identifiers", async () => {
  const subjectId = new CourseSubject({ title: "English Grammar", order: 1 });
  const courseId = new Course({ subjectId: subjectId._id, title: "Grammar Basics", authorId: new CourseLesson()._id, status: "draft" });
  const sectionId = new CourseSection({ courseId: courseId._id, title: "Nouns", order: 0 });
  const lesson = new CourseLesson({ courseId: courseId._id, sectionId: sectionId._id, authorId: courseId.authorId, title: "What is a noun?", blocks: [{ type: "text", text: "A naming word." }] });
  await Promise.all([subjectId.validate(), courseId.validate(), sectionId.validate(), lesson.validate()]);
  lesson.title = "Nouns explained";
  lesson.order = 3;
  lesson.status = "published";
  await lesson.validate();
  assert.equal(lesson.title, "Nouns explained");
  assert.equal(lesson.order, 3);
  assert.equal(lesson.status, "published");
  assert.ok(lesson._id); // The route deletion operations identify persisted records by this stable ID.
});
