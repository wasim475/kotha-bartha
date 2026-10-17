const STAFF_ROLES = new Set(["admin", "moderator"]);
const BLOCK_TYPES = new Set(["text", "image", "video", "quote", "callout", "divider"]);
const CALLOUTS = new Set(["important", "remember", "example", "warning", "tip"]);

function canManageCourses(role) { return STAFF_ROLES.has(role); }
function canManageSubjectCards(role) { return role === "admin"; }
function publicCourseFilter(courseId) { return { _id: courseId, status: "published" }; }
function publicLessonFilter(lessonId) { return { _id: lessonId, status: "published" }; }
function publicLessonListFilter(courseId, sectionId) {
  return { courseId, ...(sectionId ? { sectionId } : {}), status: "published" };
}
function normalizeOrder(value, fallback = 0) {
  return Number.isInteger(value) && value >= 0 && value <= 10000 ? value : fallback;
}

function deletionActions(kind, id) {
  if (kind === "subjects") return [{ collection: "subjects", method: "findByIdAndDelete", filter: id }];
  if (kind === "courses") return [
    { collection: "lessons", method: "deleteMany", filter: { courseId: id } },
    { collection: "sections", method: "deleteMany", filter: { courseId: id } },
    { collection: "courses", method: "findByIdAndDelete", filter: id },
  ];
  if (kind === "sections") return [
    { collection: "lessons", method: "deleteMany", filter: { sectionId: id } },
    { collection: "sections", method: "findByIdAndDelete", filter: id },
  ];
  if (kind === "lessons") return [{ collection: "lessons", method: "findByIdAndDelete", filter: id }];
  return null;
}

function normalizeLessonBlocks(input, safeUrl) {
  if (!Array.isArray(input) || input.length > 100 || input.some((block) => !block || !BLOCK_TYPES.has(block.type))) {
    return { error: "Lesson blocks are invalid." };
  }
  const blocks = input.map((block) => ({
    type: block.type,
    text: String(block.text || "").slice(0, 20000),
    title: String(block.title || "").slice(0, 200),
    url: block.type === "video" ? safeUrl(block.url, true) : block.type === "image" ? safeUrl(block.url) : "",
    alt: String(block.alt || "").slice(0, 300),
    caption: String(block.caption || "").slice(0, 500),
    variant: CALLOUTS.has(block.variant) ? block.variant : "default",
  }));
  if (blocks.some((block) => ["image", "video"].includes(block.type) && !block.url)) {
    return { error: "Use a supported secure media URL." };
  }
  return { blocks };
}

module.exports = {
  BLOCK_TYPES,
  canManageCourses,
  canManageSubjectCards,
  deletionActions,
  normalizeLessonBlocks,
  normalizeOrder,
  publicCourseFilter,
  publicLessonFilter,
  publicLessonListFilter,
};
