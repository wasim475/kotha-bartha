import test from "node:test";
import assert from "node:assert/strict";
import { applyLessonFormat, hasUnsavedLessonChanges, parseInlineLessonText, parseLessonMarkup } from "../../src/pages/Study/courses/lessonMarkup.js";

test("inline editor controls wrap selected text for bold, italic, underline and links", () => {
  assert.equal(applyLessonFormat("hello world", 6, 11, "bold").value, "hello **world**");
  assert.equal(applyLessonFormat("hello", 0, 5, "italic").value, "*hello*");
  assert.equal(applyLessonFormat("hello", 0, 5, "underline").value, "__hello__");
  assert.equal(applyLessonFormat("lesson", 0, 6, "link").value, "[lesson](https://example.com)");
  assert.equal(applyLessonFormat("lesson", 0, 6, "link", "https://example.org/grammar").value, "[lesson](https://example.org/grammar)");
});

test("heading and list controls format full selected lines and preserve following content", () => {
  assert.equal(applyLessonFormat("First\nSecond\nEnd", 0, 12, "heading").value, "## First\n## Second\nEnd");
  assert.equal(applyLessonFormat("one\ntwo", 0, 7, "bulleted-list").value, "- one\n- two");
  assert.equal(applyLessonFormat("one\ntwo", 0, 7, "numbered-list").value, "1. one\n2. two");
});

test("learner markup parser produces semantic headings, lists and paragraphs", () => {
  assert.deepEqual(parseLessonMarkup("## Topic\n\nA paragraph\ncontinued\n- one\n- two\n1. first\n2. second"), [
    { type: "heading", level: 2, text: "Topic" },
    { type: "paragraph", text: "A paragraph\ncontinued" },
    { type: "list", ordered: false, items: ["one", "two"] },
    { type: "list", ordered: true, items: ["first", "second"] },
  ]);
});

test("inline links reject unsafe schemes while formatting remains plain text", () => {
  assert.deepEqual(parseInlineLessonText("**bold** [safe](https://example.com) [bad](javascript:alert(1))"), [
    { type: "bold", text: "bold" }, { type: "text", text: " " },
    { type: "link", text: "safe", href: "https://example.com/" },
    { type: "text", text: " [bad](javascript:alert(1))" },
  ]);
  assert.equal(parseInlineLessonText("[insecure](http://example.com)")[0].type, "text");
});

test("editor dirty state clears after a successful save baseline is recorded", () => {
  const edited = { title: "Changed", blocks: [{ type: "text", text: "Lesson" }] };
  const savedSnapshot = JSON.stringify(edited);
  assert.equal(hasUnsavedLessonChanges(edited, savedSnapshot), false);
  assert.equal(hasUnsavedLessonChanges({ ...edited, title: "Changed again" }, savedSnapshot), true);
});
