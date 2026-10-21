import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { applyLessonFormat, createLessonTable, hasUnsavedLessonChanges, loadLessonBlocks, parseInlineLessonText, parseLessonMarkup, parseLessonTablePaste, pasteLessonTable, presentLessonTable, resizeLessonTable, updateLessonTableCell } from "../../src/pages/Study/courses/lessonMarkup.js";

test("existing lesson blocks load every saved text field and safely normalize legacy values", () => {
  const stored = [{ type: "text", title: "Heading", text: "## Saved\\n**bold**" }, { type: "quote", text: "A quote" }, { type: "table", rows: [["A"]] }];
  const loaded = loadLessonBlocks(stored);
  assert.equal(loaded[0].text, stored[0].text);
  assert.equal(loaded[1].text, "A quote");
  assert.equal(loaded[2].rows[0][0], "A");
  assert.notEqual(loaded[2].rows, stored[2].rows);
  assert.equal(loadLessonBlocks([{ type: "text", text: null }])[0].text, "");
  assert.deepEqual(loadLessonBlocks([]), [{ type: "text", title: "", text: "" }]);
});

test("inline editor controls wrap selected text for bold, italic, underline and links", () => {
  assert.equal(applyLessonFormat("hello world", 6, 11, "bold").value, "hello **world**");
  assert.equal(applyLessonFormat("hello", 0, 5, "italic").value, "*hello*");
  assert.equal(applyLessonFormat("hello", 0, 5, "underline").value, "__hello__");
  assert.equal(applyLessonFormat("lesson", 0, 6, "link").value, "[lesson](https://example.com)");
  assert.equal(applyLessonFormat("lesson", 0, 6, "link", "https://example.org/grammar").value, "[lesson](https://example.org/grammar)");
});

test("bold and italic commands format the saved selection range and keep selected text selected", () => {
  const value = "Before selected after";
  const start = value.indexOf("selected");
  const end = start + "selected".length;
  for (const format of ["bold", "italic"]) {
    const result = applyLessonFormat(value, start, end, format);
    assert.equal(result.value.slice(result.selectionStart, result.selectionEnd), "selected");
    assert.match(result.value, format === "bold" ? /\*\*selected\*\*/ : /\*selected\*/);
  }
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
    { type: "bold", text: "bold", children: [{ type: "text", text: "bold" }] }, { type: "text", text: " " },
    { type: "link", text: "safe", href: "https://example.com/" },
    { type: "text", text: " [bad](javascript:alert(1))" },
  ]);
  assert.equal(parseInlineLessonText("[insecure](http://example.com)")[0].type, "text");
});

test("text colors wrap selected text without losing it and restore as safe inline tokens", () => {
  const formatted = applyLessonFormat("Keep this bold **phrase**", 17, 23, "color:blue");
  assert.equal(formatted.value, "Keep this bold **{{color:blue|phrase}}**");
  assert.deepEqual(parseInlineLessonText(formatted.value).map((part) => part.type), ["text", "bold"]);
  const bold = parseInlineLessonText(formatted.value)[1];
  assert.equal(bold.children[0].type, "color");
  assert.equal(bold.children[0].children[0].text, "phrase");
  const colored = parseInlineLessonText("{{color:blue|**phrase**}}");
  assert.equal(colored[0].type, "color");
  assert.equal(colored[0].children[0].type, "bold");
  assert.equal(parseInlineLessonText("{{color:default|text}}")[0].color, "default");
  assert.equal(applyLessonFormat("phrase", 0, 6, "color:unknown").value, "phrase");
});

test("preview and learner views share the safe color-aware lesson renderer", async () => {
  const [blocks, courses] = await Promise.all([
    readFile(new URL("../../src/pages/Study/courses/LessonBlocks.jsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/pages/Study/courses/Courses.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(blocks, /LESSON_TEXT_COLORS\[part\.color\]/);
  assert.match(blocks, /function InlinePart/);
  assert.match(courses, /<LessonBlocks blocks=\{form\.blocks\}/);
  assert.match(courses, /<LessonBlocks blocks=\{lesson\.blocks\}/);
});

test("color palette stays open for inside clicks, closes outside or on Escape, and supports keyboard state", async () => {
  const toolbar = await readFile(new URL("../../src/pages/Study/courses/LessonFormatToolbar.jsx", import.meta.url), "utf8");
  assert.match(toolbar, /paletteRef\.current\?\.contains\(event\.target\)/);
  assert.match(toolbar, /event\.key === "Escape"/);
  assert.match(toolbar, /aria-expanded=\{colorOpen\}/);
  assert.match(toolbar, /onClick=\{\(\) => onToggleColors\(blockIndex\)\}/);
  assert.match(toolbar, /onFormat\(blockIndex, `color:\$\{color\}`\)/);
  assert.match(toolbar, /onMouseDown=\{keepEditorSelection\}/);
});

test("reopening a saved lesson preserves inline markup when formatting and saving again", () => {
  const saved = [{ type: "text", text: "## Topic\\nKeep **bold** and {{color:blue|blue}}" }];
  const reopened = loadLessonBlocks(saved);
  const original = reopened[0].text;
  const start = original.indexOf("blue}}");
  const result = applyLessonFormat(original, start, start, "italic");
  const savedAgain = loadLessonBlocks([{ ...reopened[0], text: result.value }]);
  assert.equal(savedAgain[0].text, result.value);
  assert.match(savedAgain[0].text, /\*\*bold\*\*/);
  assert.match(savedAgain[0].text, /\{\{color:blue\|\*text\*blue\}\}/);
  assert.match(savedAgain[0].text, /\*text\*/);
});

test("editor dirty state clears after a successful save baseline is recorded", () => {
  const edited = { title: "Changed", blocks: [{ type: "text", text: "Lesson" }] };
  const savedSnapshot = JSON.stringify(edited);
  assert.equal(hasUnsavedLessonChanges(edited, savedSnapshot), false);
  assert.equal(hasUnsavedLessonChanges({ ...edited, title: "Changed again" }, savedSnapshot), true);
});

test("table editor creates configurable structured rows and columns and preserves edits while resizing", () => {
  const table = createLessonTable(3, 4);
  assert.equal(table.type, "table");
  assert.equal(table.firstRowHeader, true);
  assert.deepEqual(table.rows.map((row) => row.length), [4, 4, 4]);
  const edited = updateLessonTableCell(table, 1, 2, "<b>plain text</b>");
  const resized = resizeLessonTable(edited, 4, 5);
  assert.equal(resized.rows[1][2], "<b>plain text</b>");
  assert.equal(resized.rows[3][4], "");
  assert.deepEqual(resizeLessonTable(resized, 1, 1).rows, [[""]]);
  assert.equal(createLessonTable(99, 99).rows.length, 30);
  assert.equal(createLessonTable(99, 99).rows[0].length, 12);
});

test("HTML table paste extracts text cells and decodes entities without interpreting clipboard markup", () => {
  assert.deepEqual(parseLessonTablePaste("<table><tr><th>Subject</th><th>Rule</th></tr><tr><td><b>Preposition</b></td><td>Shows &amp; explains<br>relationships</td></tr></table>", "ignored"), [
    ["Subject", "Rule"], ["Preposition", "Shows & explains\nrelationships"],
  ]);
});

test("tab-separated paste keeps commas and quoted multiline cells intact", () => {
  assert.deepEqual(parseLessonTablePaste("", "Subject\tRule\tExample\r\nBengali\tShows relationships\tবাংলা, English\nNote\t\"line one\nline two\"\tA, B"), [
    ["Subject", "Rule", "Example"], ["Bengali", "Shows relationships", "বাংলা, English"], ["Note", "line one\nline two", "A, B"],
  ]);
});

test("Markdown pipe tables accept outer pipes, skip separator rows, and keep uneven cells", () => {
  assert.deepEqual(parseLessonTablePaste("", "| Subject | Rule | Example |\n| --- | :---: | ---: |\n| Preposition | Shows relationships | The book is on the table. |\n| Conjunction | Connects words | I was tired, but I continued. |\n| Uneven | only two |"), [
    ["Subject", "Rule", "Example"], ["Preposition", "Shows relationships", "The book is on the table."],
    ["Conjunction", "Connects words", "I was tired, but I continued."], ["Uneven", "only two"],
  ]);
});

test("table paste expands from the selected cell and preserves content outside the pasted range", () => {
  const table = { type: "table", rows: [["A", "keep"], ["below", "also keep"]], firstRowHeader: true };
  const expanded = pasteLessonTable(table, 0, 1, [["pasted", "new column"], ["second row", ""]]);
  assert.deepEqual(expanded.rows, [["A", "pasted", "new column"], ["below", "second row", "" ]]);
  assert.equal(expanded.firstRowHeader, true);
  const bounded = pasteLessonTable(createLessonTable(30, 12), 29, 11, [["last", "ignored column"], ["ignored row"]]);
  assert.equal(bounded.rows.length, 30);
  assert.equal(bounded.rows[0].length, 12);
  assert.equal(bounded.rows[29][11], "last");
});

test("ordinary non-table paste is left to the native text paste behavior", () => {
  assert.equal(parseLessonTablePaste("", "This is a sentence, with commas.\nAnd a second line."), null);
});

test("table cell editor intercepts only recognized grids and exposes clipboard import", async () => {
  const editor = await readFile(new URL("../../src/pages/Study/courses/Courses.jsx", import.meta.url), "utf8");
  assert.match(editor, /onPaste=\{\(event\) => pasteTable\(event, i, rowIndex, columnIndex\)\}/);
  assert.match(editor, /if \(!pastedRows\) return;/);
  assert.match(editor, /Import clipboard table/);
  assert.match(editor, /onKeyDown=\{\(event\) => navigateTableCell/);
});

test("table presentation keeps cell content as text and marks only first-row headers", () => {
  const table = presentLessonTable({ title: "Vocabulary", firstRowHeader: true, rows: [["Word", "Meaning"], ["<script>alert(1)</script>", "A name"]] });
  assert.equal(table.caption, "Vocabulary");
  assert.equal(table.rows[0].cells[0].header, true);
  assert.equal(table.rows[1].cells[0].header, false);
  assert.equal(table.rows[1].cells[0].text, "<script>alert(1)</script>");
  assert.equal(presentLessonTable({ rows: [] }), null);
});

test("lesson table styles constrain the page and allow horizontal scrolling on mobile", async () => {
  const css = await readFile(new URL("../../src/CSS/study.css", import.meta.url), "utf8");
  assert.match(css, /\.lesson-table-scroll\{[^}]*max-width:100%[^}]*overflow-x:auto/);
  assert.match(css, /\.lesson-table\{[^}]*width:max-content/);
});

test("lesson reading styles widen the article, switch to a mobile curriculum drawer, and keep controls off the reading overlay", async () => {
  const css = await readFile(new URL("../../src/CSS/study.css", import.meta.url), "utf8");
  const lessonStyles = css.slice(css.indexOf("/* Courses lesson reading layout */"));
  assert.match(lessonStyles, /\.lesson-layout\{display:grid;grid-template-columns:minmax\(210px,240px\) minmax\(0,760px\)/);
  assert.match(lessonStyles, /@media\(max-width:1024px\)\{[\s\S]*?\.lesson-sidebar\{display:none\}[\s\S]*?\.mobile-curriculum-toggle\{display:inline-flex/);
  assert.match(lessonStyles, /\.lesson-curriculum-drawer\{[^}]*height:100dvh/);
  assert.match(lessonStyles, /\.lesson-pagination\{position:static/);
  assert.match(lessonStyles, /font-family:var\(--font-message/);
});
