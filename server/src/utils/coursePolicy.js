const STAFF_ROLES = new Set(["admin", "moderator"]);
const BLOCK_TYPES = new Set(["text", "image", "video", "quote", "callout", "divider", "table"]);
const CALLOUTS = new Set(["important", "remember", "example", "warning", "tip"]);
const TABLE_MAX_ROWS = 30;
const TABLE_MAX_COLUMNS = 12;
const TABLE_MAX_CELL_LENGTH = 2000;
const TABLE_MAX_CONTENT_LENGTH = 40000;

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

function hasUnsafeMarkdownLinks(text) {
  const links = String(text || "").matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g);
  for (const link of links) {
    try { if (new URL(link[1]).protocol !== "https:") return true; }
    catch { return true; }
  }
  return false;
}

function normalizeLessonBlocks(input, safeUrl) {
  if (!Array.isArray(input) || input.length > 100 || input.some((block) => !block || !BLOCK_TYPES.has(block.type))) {
    return { error: "Lesson blocks are invalid." };
  }
  for (const block of input.filter((item) => item.type === "table")) {
    const rows = block.rows;
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > TABLE_MAX_ROWS || !Array.isArray(rows[0]) || rows[0].length < 1 || rows[0].length > TABLE_MAX_COLUMNS) {
      return { error: `Tables need 1–${TABLE_MAX_ROWS} rows and 1–${TABLE_MAX_COLUMNS} columns.` };
    }
    const columns = rows[0].length;
    if (rows.some((row) => !Array.isArray(row) || row.length !== columns || row.some((cell) => typeof cell !== "string" || cell.length > TABLE_MAX_CELL_LENGTH))) {
      return { error: "Table rows must have the same number of text cells, each 2000 characters or fewer." };
    }
    if (rows.flat().reduce((total, cell) => total + cell.length, 0) > TABLE_MAX_CONTENT_LENGTH) {
      return { error: "Table content must be 40000 characters or fewer." };
    }
    if (block.firstRowHeader !== undefined && typeof block.firstRowHeader !== "boolean") {
      return { error: "Table header setting must be true or false." };
    }
  }
  const blocks = input.map((block) => ({
    type: block.type,
    text: String(block.text || "").slice(0, 20000),
    title: String(block.title || "").slice(0, 200),
    url: block.type === "video" ? safeUrl(block.url, true) : block.type === "image" ? safeUrl(block.url) : "",
    alt: String(block.alt || "").slice(0, 300),
    caption: String(block.caption || "").slice(0, 500),
    variant: CALLOUTS.has(block.variant) ? block.variant : "default",
    ...(block.type === "table" ? { rows: block.rows.map((row) => row.slice()), firstRowHeader: block.firstRowHeader === true } : {}),
  }));
  if (blocks.some((block) => ["text", "quote", "callout"].includes(block.type) && hasUnsafeMarkdownLinks(block.text))) {
    return { error: "Lesson links must use valid HTTPS URLs." };
  }
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
  hasUnsafeMarkdownLinks,
  normalizeLessonBlocks,
  normalizeOrder,
  publicCourseFilter,
  publicLessonFilter,
  publicLessonListFilter,
};
