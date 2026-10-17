const FORMATS = {
  bold: ["**", "**"],
  italic: ["*", "*"],
  underline: ["__", "__"],
  link: ["[", "](https://example.com)"],
};

export function hasUnsavedLessonChanges(value, baseline) {
  return JSON.stringify(value) !== baseline;
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
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*/g;
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const index = match.index;
    if (index > cursor) tokens.push({ type: "text", text: source.slice(cursor, index) });
    if (match[1] !== undefined) {
      const href = safeHref(match[2]);
      tokens.push(href ? { type: "link", text: match[1], href } : { type: "text", text: match[0] });
    } else if (match[3] !== undefined) tokens.push({ type: "bold", text: match[3] });
    else if (match[4] !== undefined) tokens.push({ type: "underline", text: match[4] });
    else tokens.push({ type: "italic", text: match[5] });
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
