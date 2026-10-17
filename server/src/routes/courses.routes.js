const express = require("express");
const mongoose = require("mongoose");
const { requireRole } = require("../middleware/requireRole");
const CourseSubject = require("../models/CourseSubject");
const Course = require("../models/Course");
const CourseSection = require("../models/CourseSection");
const CourseLesson = require("../models/CourseLesson");
const CourseLessonQuestion = require("../models/CourseLessonQuestion");
const CourseLessonAttempt = require("../models/CourseLessonAttempt");
const CourseLessonProgress = require("../models/CourseLessonProgress");
const { upload } = require("../middleware/upload");
const { uploadBuffer } = require("../utils/cloudinary");
const { canManageSubjectCards, deletionActions, normalizeLessonBlocks, normalizeOrder, publicCourseFilter, publicLessonFilter, publicLessonListFilter } = require("../utils/coursePolicy");
const courseTestsRoutes = require("./courseTests.routes");

const router = express.Router();
const staff = requireRole("admin", "moderator");
const seeds = [
  { title: "English Grammar", description: "Build strong English foundations, one clear lesson at a time.", order: 0 },
  { title: "বাংলা গ্রামার", description: "বাংলা ভাষার ব্যাকরণ সহজভাবে শিখুন।", order: 1 },
  { title: "Mathematics", description: "Understand mathematical ideas through guided lessons.", order: 2 },
];
const validId = (id) => mongoose.isValidObjectId(id);
const safeUrl = (value, video = false) => {
  if (!value) return "";
  try {
    const url = new URL(String(value));
    if (url.protocol !== "https:") return null;
    const hosts = video ? ["youtube.com", "www.youtube.com", "youtu.be", "www.youtube-nocookie.com"] : null;
    if (hosts && !hosts.includes(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch { return null; }
};
const idError = (res) => res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid content ID." } });

router.post("/staff/courses/upload-image", staff, upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file || !req.file.mimetype.startsWith("image/")) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Choose an image file." } });
    if (req.file.size > 5 * 1024 * 1024) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Images must be 5 MB or smaller." } });
    const result = await uploadBuffer(req.file.buffer, { kind: "image", folder: "kotha-study/courses" });
    res.status(201).json({ data: { secureUrl: result.secure_url, publicId: result.public_id } });
  } catch (e) { next(e); }
});

router.get("/courses/subjects", async (req, res, next) => {
  try {
    for (const seed of seeds) await CourseSubject.updateOne({ title: seed.title }, { $setOnInsert: seed }, { upsert: true });
    const subjects = await CourseSubject.find({ visible: true }).sort({ order: 1, title: 1 }).lean();
    const ids = subjects.map((s) => s._id);
    const courses = await Course.find({ subjectId: { $in: ids }, status: "published" }).sort({ order: 1, title: 1 }).lean();
    const courseIds = courses.map((c) => c._id);
    const [sections, lessonCounts] = await Promise.all([
      CourseSection.find({ courseId: { $in: courseIds }, visible: true }).select("courseId").lean(),
      CourseLesson.aggregate([{ $match: { courseId: { $in: courseIds }, status: "published" } }, { $group: { _id: "$courseId", count: { $sum: 1 } } }]),
    ]);
    const countMap = new Map(lessonCounts.map((x) => [String(x._id), x.count]));
    res.json({ data: subjects.map((subject) => {
      const related = courses.filter((c) => String(c.subjectId) === String(subject._id));
      return { ...subject, courseCount: related.length, sectionCount: sections.filter((s) => related.some((c) => String(c._id) === String(s.courseId))).length, lessonCount: related.reduce((n, c) => n + (countMap.get(String(c._id)) || 0), 0), courses: related };
    }) });
  } catch (e) { next(e); }
});

router.get("/courses/:courseId", async (req, res, next) => {
  try {
    if (!validId(req.params.courseId)) return idError(res);
    const course = await Course.findOne(publicCourseFilter(req.params.courseId)).populate("subjectId", "title").lean();
    if (!course) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Course not found." } });
    const sections = await CourseSection.find({ courseId: course._id, visible: true }).sort({ order: 1, _id: 1 }).lean();
    const lessons = await CourseLesson.find({ ...publicLessonListFilter(course._id), sectionId: { $in: sections.map((s) => s._id) } }).select("title description sectionId order updatedAt").sort({ order: 1, _id: 1 }).lean();
    res.json({ data: { ...course, sections: sections.map((section) => ({ ...section, lessons: lessons.filter((l) => String(l.sectionId) === String(section._id)) })) } });
  } catch (e) { next(e); }
});

router.get("/courses/lessons/:lessonId", async (req, res, next) => {
  try {
    if (!validId(req.params.lessonId)) return idError(res);
    const lesson = await CourseLesson.findOne(publicLessonFilter(req.params.lessonId)).lean();
    if (!lesson) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Lesson not found." } });
    const course = await Course.findOne(publicCourseFilter(lesson.courseId)).lean();
    const section = await CourseSection.findOne({ _id: lesson.sectionId, courseId: lesson.courseId, visible: true }).lean();
    if (!course || !section) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Lesson not found." } });
    const curriculum = await CourseLesson.find(publicLessonListFilter(course._id)).select("_id title sectionId order").sort({ order: 1, _id: 1 }).lean();
    const visibleSections = await CourseSection.find({ courseId: course._id, visible: true }).select("_id title order").sort({ order: 1, _id: 1 }).lean();
    const all = curriculum.map((item) => ({ ...item, section: visibleSections.find((s) => String(s._id) === String(item.sectionId)) })).filter((item) => item.section);
    const index = all.findIndex((item) => String(item._id) === String(lesson._id));
    res.json({ data: { lesson, course: { _id: course._id, title: course.title }, section, previous: all[index - 1] || null, next: all[index + 1] || null, curriculum: all } });
  } catch (e) { next(e); }
});

// Staff workspace payload includes drafts and is never available to learners.
router.get("/staff/courses", staff, async (req, res, next) => {
  try {
    const [subjects, courses, sections, lessons] = await Promise.all([
      CourseSubject.find().sort({ order: 1 }).lean(), Course.find().sort({ order: 1, createdAt: -1 }).lean(),
      CourseSection.find().sort({ order: 1 }).lean(), CourseLesson.find().select("title description courseId sectionId status testPublished order authorId updatedAt").sort({ order: 1 }).lean(),
    ]);
    const questionCounts = await CourseLessonQuestion.aggregate([{ $match: { lessonId: { $in: lessons.map((lesson) => lesson._id) } } }, { $group: { _id: "$lessonId", count: { $sum: 1 } } }]);
    const countByLesson = new Map(questionCounts.map((entry) => [String(entry._id), entry.count]));
    res.json({ data: { subjects, courses, sections, lessons: lessons.map((lesson) => ({ ...lesson, questionCount: countByLesson.get(String(lesson._id)) || 0 })) } });
  } catch (e) { next(e); }
});

// Mount specific test/question routes before the generic staff CRUD patterns.
router.use(courseTestsRoutes);

router.post("/staff/courses/:kind", staff, async (req, res, next) => {
  try {
    const { kind } = req.params;
    if (kind === "subjects" && !canManageSubjectCards(req.user.role)) return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only admins can manage subject cards." } });
    const body = req.body || {};
    const title = String(body.title || "").trim();
    if (!title || title.length > 160) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "A valid title is required." } });
    const order = normalizeOrder(body.order);
    const base = { title, order };
    let doc;
    if (kind === "subjects") doc = await CourseSubject.create({ ...base, description: String(body.description || "").slice(0, 500), coverUrl: safeUrl(body.coverUrl) ?? "", visible: body.visible !== false });
    else if (kind === "courses") {
      if (!validId(body.subjectId) || !(await CourseSubject.exists({ _id: body.subjectId }))) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Choose a valid subject." } });
      doc = await Course.create({ ...base, subjectId: body.subjectId, description: String(body.description || "").slice(0, 1000), coverUrl: safeUrl(body.coverUrl) ?? "", authorId: req.user._id, status: body.status === "published" ? "published" : "draft" });
    } else if (kind === "sections") {
      if (!validId(body.courseId) || !(await Course.exists({ _id: body.courseId }))) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Choose a valid course." } });
      doc = await CourseSection.create({ ...base, courseId: body.courseId, description: String(body.description || "").slice(0, 500), visible: body.visible !== false });
    } else if (kind === "lessons") {
      if (!validId(body.courseId) || !validId(body.sectionId) || !(await CourseSection.exists({ _id: body.sectionId, courseId: body.courseId }))) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Choose a section in the selected course." } });
      const normalized = normalizeLessonBlocks(body.blocks ?? [], safeUrl);
      if (normalized.error) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: normalized.error } });
      doc = await CourseLesson.create({ ...base, courseId: body.courseId, sectionId: body.sectionId, description: String(body.description || "").slice(0, 600), blocks: normalized.blocks, authorId: req.user._id, status: body.status === "published" ? "published" : "draft" });
    } else return res.status(404).json({ error: { code: "NOT_FOUND", message: "Unknown content type." } });
    res.status(201).json({ data: doc });
  } catch (e) { next(e); }
});

router.patch("/staff/courses/:kind/:id", staff, async (req, res, next) => {
  try {
    const { kind, id } = req.params;
    if (kind === "subjects" && !canManageSubjectCards(req.user.role)) return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only admins can manage subject cards." } });
    if (!validId(id)) return idError(res);
    const Model = { subjects: CourseSubject, courses: Course, sections: CourseSection, lessons: CourseLesson }[kind];
    if (!Model) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Unknown content type." } });
    const doc = await Model.findById(id);
    if (!doc) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Content not found." } });
    if (kind === "lessons" && req.user.role === "moderator" && String(doc.authorId) !== String(req.user._id)) return res.status(403).json({ error: { code: "FORBIDDEN", message: "Moderators can edit only lessons they created." } });
    const b = req.body || {};
    if (b.title !== undefined) { const value = String(b.title).trim(); if (!value || value.length > 160) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "A valid title is required." } }); doc.title = value; }
    if (b.description !== undefined) doc.description = String(b.description).slice(0, kind === "courses" ? 1000 : 600);
    if (b.coverUrl !== undefined && kind !== "lessons" && kind !== "sections") { const url = safeUrl(b.coverUrl); if (url === null) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Use a secure image URL." } }); doc.coverUrl = url; }
    if (b.order !== undefined) { if (normalizeOrder(b.order, null) === null) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Order must be between 0 and 10000." } }); doc.order = b.order; }
    if (b.status !== undefined && kind !== "subjects" && kind !== "sections") { if (!["draft", "published"].includes(b.status)) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid publication status." } }); doc.status = b.status; }
    if (b.visible !== undefined && ["subjects", "sections"].includes(kind)) doc.visible = Boolean(b.visible);
    if (kind === "courses" && b.subjectId !== undefined) { if (!validId(b.subjectId) || !(await CourseSubject.exists({ _id: b.subjectId }))) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Choose a valid subject." } }); doc.subjectId = b.subjectId; }
    if (kind === "lessons") {
      if (b.courseId !== undefined || b.sectionId !== undefined) {
        const courseId = b.courseId || doc.courseId; const sectionId = b.sectionId || doc.sectionId;
        if (!validId(courseId) || !validId(sectionId) || !(await CourseSection.exists({ _id: sectionId, courseId }))) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Choose a section in the selected course." } });
        doc.courseId = courseId; doc.sectionId = sectionId;
      }
      if (b.blocks !== undefined) {
        const normalized = normalizeLessonBlocks(b.blocks, safeUrl);
        if (normalized.error) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: normalized.error } });
        doc.blocks = normalized.blocks;
      }
    }
    await doc.save(); res.json({ data: doc });
  } catch (e) { next(e); }
});

router.delete("/staff/courses/:kind/:id", staff, async (req, res, next) => {
  try {
    const { kind, id } = req.params; if (!validId(id)) return idError(res);
    if (kind === "subjects" && !canManageSubjectCards(req.user.role)) return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only admins can manage subject cards." } });
    if (kind === "lessons" && req.user.role === "moderator") {
      const lesson = await CourseLesson.findById(id).select("authorId").lean();
      if (lesson && String(lesson.authorId) !== String(req.user._id)) return res.status(403).json({ error: { code: "FORBIDDEN", message: "Moderators can delete only lessons they created." } });
    }
    if (kind === "subjects" && await Course.exists({ subjectId: id })) return res.status(409).json({ error: { code: "IN_USE", message: "Move or remove its courses before deleting this subject." } });
    const actions = deletionActions(kind, id);
    if (!actions) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Unknown content type." } });
    let lessonIds = [];
    if (kind === "lessons") lessonIds = [id];
    else if (kind === "courses" || kind === "sections") {
      const lessonFilter = kind === "courses" ? { courseId: id } : { sectionId: id };
      lessonIds = (await CourseLesson.find(lessonFilter).select("_id").lean()).map((lesson) => lesson._id);
    }
    if (lessonIds.length) {
      await Promise.all([
        CourseLessonQuestion.deleteMany({ lessonId: { $in: lessonIds } }),
        CourseLessonAttempt.deleteMany({ lessonId: { $in: lessonIds } }),
        CourseLessonProgress.deleteMany({ lessonId: { $in: lessonIds } }),
      ]);
    }
    const models = { subjects: CourseSubject, courses: Course, sections: CourseSection, lessons: CourseLesson };
    for (const action of actions) await models[action.collection][action.method](action.filter);
    res.json({ data: { deleted: true } });
  } catch (e) { next(e); }
});

module.exports = router;
