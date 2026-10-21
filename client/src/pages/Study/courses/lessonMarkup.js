const FORMATS = {
  bold: ["**", "**"],
  italic: ["*", "*"],
  underline: ["__", "__"],
  link: ["[", "](https://example.com)"],
};

export const LESSON_TEXT_COLORS = {
  default: null,
  red: "var(--lesson-color-red)",
  orange: "var(--lesson-color-orange)",
  green: "var(--lesson-color-green)",
  blue: "var(--lesson-color-blue)",
  purple: "var(--lesson-color-purple)",
  highlight: "var(--lesson-color-highlight)",
};

export function hasUnsavedLessonChanges(value, baseline) {
  return JSON.stringify(value) !== baseline;
}

export function loadLessonBlocks(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return [{ type: "text", title: "", text: "" }];
  return blocks.map((block) => ({
    ...block,
    text: typeof block.text === "string" ? block.text : "",
    title: typeof block.title === "string" ? block.title : "",
    rows: Array.isArray(block.rows) ? block.rows.map((row) => Array.isArray(row) ? [...row] : []) : [],
  }));
}

export function createLessonTable(rowCount = 2, columnCount = 2) {
  const rows = Math.max(1, Math.min(30, Math.floor(Number(rowCount) || 1)));
  const columns = Math.max(1, Math.min(12, Math.floor(Number(columnCount) || 1)));
  return { type: "table", rows: Array.from({ length: rows }, () => Array(columns).fill("")), firstRowHeader: true };
}

export function resizeLessonTable(table, rowCount, columnCount) {
  const rows = Math.max(1, Math.min(30, Math.floor(Number(rowCount) || 1)));
  const columns = Math.max(1, Math.min(12, Math.floor(Number(columnCount) || 1)));
  return {
    ...table,
    rows: Array.from({ length: rows }, (_, rowIndex) =>
      Array.from({ length: columns }, (_, columnIndex) => table.rows?.[rowIndex]?.[columnIndex] || "")),
  };
}

export function updateLessonTableCell(table, rowIndex, columnIndex, value) {
  return { ...table, rows: table.rows.map((row, index) => index === rowIndex ? row.map((cell, col) => col === columnIndex ? value : cell) : row) };
}

function decodeTableEntities(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code) => {
    const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
    if (code[0] !== "#") return named[code.toLowerCase()] ?? entity;
    const number = code[1].toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
    return Number.isFinite(number) && number >= 0 && number <= 0x10ffff ? String.fromCodePoint(number) : entity;
  });
}

function htmlCellText(markup) {
  return decodeTableEntities(markup
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|li)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, ""))
    .replace(/^\n+|\n+$/g, "");
}

function parseHtmlLessonTable(html) {
  if (!/<table\b/i.test(html)) return null;
  const tables = html.match(/<table\b[^>]*>[\s\S]*?<\/table\s*>/gi) || [];
  const table = tables[0];
  if (!table) return null;
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)].map(([, rowMarkup]) =>
    [...rowMarkup.matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)].map(([, , cellMarkup]) => htmlCellText(cellMarkup)));
  return rows.some((row) => row.length) ? rows.filter((row) => row.length) : null;
}

function parseDelimitedRows(value, delimiter) {
  const rows = [[]];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '"') {
      if (quoted && value[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (!quoted && character === delimiter) {
      rows[rows.length - 1].push(cell); cell = "";
    } else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && value[index + 1] === "\n") index += 1;
      rows[rows.length - 1].push(cell); rows.push([]); cell = "";
    } else cell += character;
  }
  rows[rows.length - 1].push(cell);
  return rows;
}

function parsePipeRows(value) {
  const lines = value.replace(/\r\n?/g, "\n").split("\n").filter((line) => line.trim());
  if (!lines.length || !lines.some((line) => line.includes("|"))) return null;
  const rows = lines.map((line) => {
    let normalized = line.trim();
    if (normalized.startsWith("|")) normalized = normalized.slice(1);
    if (normalized.endsWith("|")) normalized = normalized.slice(0, -1);
    return normalized.split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, "|").trim());
  });
  return rows.filter((row) => !row.every((cell) => /^:?-{3,}:?$/.test(cell))) ;
}

export function parseLessonTablePaste(html = "", plainText = "") {
  if (typeof html === "string") {
    const parsedHtml = parseHtmlLessonTable(html);
    if (parsedHtml) return parsedHtml;
  }
  if (typeof plainText !== "string" || !plainText.trim()) return null;
  const value = plainText.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  if (value.includes("\t")) return parseDelimitedRows(value, "\t");
  const pipes = parsePipeRows(value);
  return pipes?.some((row) => row.length > 1) ? pipes : null;
}

export function pasteLessonTable(table, startRow, startColumn, pastedRows) {
  if (!Array.isArray(pastedRows) || !pastedRows.length) return table;
  const maxRows = Math.min(30, Math.max(table.rows?.length || 1, startRow + pastedRows.length));
  const pastedColumns = Math.max(1, ...pastedRows.map((row) => row.length));
  const maxColumns = Math.min(12, Math.max(table.rows?.[0]?.length || 1, startColumn + pastedColumns));
  const expanded = resizeLessonTable(table, maxRows, maxColumns);
  const rows = expanded.rows.map((row) => [...row]);
  pastedRows.slice(0, Math.max(0, maxRows - startRow)).forEach((pastedRow, rowOffset) => {
    pastedRow.slice(0, Math.max(0, maxColumns - startColumn)).forEach((value, columnOffset) => {
      rows[startRow + rowOffset][startColumn + columnOffset] = String(value).slice(0, 2000);
    });
  });
  return { ...expanded, rows };
}

export function presentLessonTable(table) {
  if (!Array.isArray(table?.rows) || !table.rows.length || !table.rows.every((row) => Array.isArray(row))) return null;
  return {
    caption: typeof table.title === "string" ? table.title : "",
    rows: table.rows.map((row, rowIndex) => ({
      cells: row.map((cell) => ({ header: table.firstRowHeader === true && rowIndex === 0, text: typeof cell === "string" ? cell : "" })),
    })),
  };
}

export function applyLessonFormat(value, start, end, format, linkUrl = "https://example.com") {
  const text = String(value || "");
  const selected = text.slice(start, end);
  if (format === "heading") {
    const lineStart = text.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const lineEnd = text.indexOf("\n", end);
    const stop = lineEnd < 0 ? text.length : lineEnd;
    const lines = text.slice(lineStart, stop).split("\n");
    const updated = lines.map((line) => `## ${line.replace(/^#{1,3}\s+/, "")}`).join("\n");
    return { value: text.slice(0, lineStart) + updated + text.slice(stop), selectionStart: lineStart, selectionEnd: lineStart + updated.length };
  }
  if (format === "bulleted-list" || format === "numbered-list") {
    const lineStart = text.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const lineEnd = text.indexOf("\n", end);
    const stop = lineEnd < 0 ? text.length : lineEnd;
    const lines = text.slice(lineStart, stop).split("\n");
    const updated = lines.map((line, index) => `${format === "bulleted-list" ? "- " : `${index + 1}. `}${line.replace(/^(?:- |\d+\. )/, "")}`).join("\n");
    return { value: text.slice(0, lineStart) + updated + text.slice(stop), selectionStart: lineStart, selectionEnd: lineStart + updated.length };
  }
  if (format.startsWith("color:")) {
    const color = format.slice(6);
    if (!Object.hasOwn(LESSON_TEXT_COLORS, color)) return { value: text, selectionStart: start, selectionEnd: end };
    const content = selected || "text";
    const replacement = `{{color:${color}|${content}}}`;
    const selectionStart = start + `{{color:${color}|`.length;
    return { value: text.slice(0, start) + replacement + text.slice(end), selectionStart, selectionEnd: selectionStart + content.length };
  }
  const [before, after] = format === "link" ? ["[", `](${linkUrl})`] : FORMATS[format] || ["", ""];
  if (!before) return { value: text, selectionStart: start, selectionEnd: end };
  const replacement = `${before}${selected || "text"}${after}`;
  const selectionStart = start + before.length;
  return { value: text.slice(0, start) + replacement + text.slice(end), selectionStart, selectionEnd: selectionStart + (selected || "text").length };
}

function safeHref(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch { return null; }
}

export function parseInlineLessonText(value) {
  const source = String(value || "");
  const tokens = [];
  const pattern = /\{\{color:(default|red|orange|green|blue|purple|highlight)\|([\s\S]*?)\}\}|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*/g;
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const index = match.index;
    if (index > cursor) tokens.push({ type: "text", text: source.slice(cursor, index) });
    if (match[1] !== undefined) tokens.push({ type: "color", color: match[1], children: parseInlineLessonText(match[2]) });
    else if (match[3] !== undefined) {
      const href = safeHref(match[4]);
      tokens.push(href ? { type: "link", text: match[3], href } : { type: "text", text: match[0] });
    } else if (match[5] !== undefined) tokens.push({ type: "bold", text: match[5], children: parseInlineLessonText(match[5]) });
    else if (match[6] !== undefined) tokens.push({ type: "underline", text: match[6], children: parseInlineLessonText(match[6]) });
    else tokens.push({ type: "italic", text: match[7], children: parseInlineLessonText(match[7]) });
    cursor = index + match[0].length;
  }
  if (cursor < source.length) tokens.push({ type: "text", text: source.slice(cursor) });
  return tokens.reduce((result, part) => {
    const previous = result[result.length - 1];
    if (previous?.type === "text" && part.type === "text") previous.text += part.text;
    else result.push(part);
    return result;
  }, []);
}

export function parseLessonMarkup(value) {
  const lines = String(value || "").split("\n");
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) { blocks.push({ type: "heading", level: heading[1].length, text: heading[2] }); index += 1; continue; }
    if (/^-\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^-\s+/.test(lines[index])) items.push(lines[index++].replace(/^-\s+/, ""));
      blocks.push({ type: "list", ordered: false, items }); continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) items.push(lines[index++].replace(/^\d+\.\s+/, ""));
      blocks.push({ type: "list", ordered: true, items }); continue;
    }
    const paragraph = [line]; index += 1;
    while (index < lines.length && lines[index].trim() && !/^(?:#{1,3}\s+|-\s+|\d+\.\s+)/.test(lines[index])) paragraph.push(lines[index++]);
    blocks.push({ type: "paragraph", text: paragraph.join("\n") });
  }
  return blocks;
}
