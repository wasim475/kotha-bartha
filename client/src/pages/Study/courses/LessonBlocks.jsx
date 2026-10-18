import { LESSON_TEXT_COLORS, parseInlineLessonText, parseLessonMarkup, presentLessonTable } from "./lessonMarkup";

function InlineText({ value }) {
  return parseInlineLessonText(value).map((part, index) => <InlinePart key={index} part={part}/>);
}

function InlinePart({ part }) {
  if (part.type === "bold") return <strong>{part.children.map((child, index) => <InlinePart key={index} part={child}/>)}</strong>;
  if (part.type === "italic") return <em>{part.children.map((child, index) => <InlinePart key={index} part={child}/>)}</em>;
  if (part.type === "underline") return <u>{part.children.map((child, index) => <InlinePart key={index} part={child}/>)}</u>;
  if (part.type === "link") return <a href={part.href} target="_blank" rel="noreferrer">{part.text}</a>;
  if (part.type === "color") return <span style={part.color === "default" ? undefined : { color: LESSON_TEXT_COLORS[part.color] }}>{part.children.map((child, index) => <InlinePart key={index} part={child}/>)}</span>;
  return part.text;
}

function RichText({ value }) {
  return parseLessonMarkup(value).map((block, index) => {
    if (block.type === "heading") {
      const Heading = `h${block.level + 1}`;
      return <Heading key={index}><InlineText value={block.text}/></Heading>;
    }
    if (block.type === "list") {
      const List = block.ordered ? "ol" : "ul";
      return <List key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><InlineText value={item}/></li>)}</List>;
    }
    return <p key={index}><InlineText value={block.text}/></p>;
  });
}

export default function LessonBlocks({ blocks = [] }) {
  return <div className="lesson-content">{blocks.map((block, index) => {
    if (block.type === "divider") return <hr key={index}/>;
    if (block.type === "table") {
      const table = presentLessonTable(block);
      if (!table) return null;
      return <div key={index} className="lesson-table-scroll" role="region" aria-label={`${table.caption || "Lesson table"} (scroll horizontally if needed)`} tabIndex="0"><table className="lesson-table">{table.caption && <caption>{table.caption}</caption>}<tbody>{table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.cells.map((cell, columnIndex) => cell.header ? <th scope="col" key={columnIndex}>{cell.text}</th> : <td key={columnIndex}>{cell.text}</td>)}</tr>)}</tbody></table></div>;
    }
    if (block.type === "image") return <figure key={index}><img className="lesson-image" src={block.url} alt={block.alt || ""}/>{block.caption && <figcaption>{block.caption}</figcaption>}</figure>;
    if (block.type === "video") {
      try {
        const url = new URL(block.url);
        const embed = url.hostname.includes("youtu.be") ? `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1)}` : `https://www.youtube-nocookie.com/embed/${url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).pop()}`;
        return <figure key={index} className="lesson-video"><iframe src={embed} title={block.title || "Lesson video"} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/>{block.caption && <figcaption>{block.caption}</figcaption>}</figure>;
      } catch { return null; }
    }
    if (block.type === "quote") return <blockquote key={index}><RichText value={block.text}/></blockquote>;
    if (block.type === "callout") return <aside className={`lesson-callout ${block.variant}`} key={index}><b>{block.title || block.variant || "Note"}</b><RichText value={block.text}/></aside>;
    if (block.type === "text") return <div className="lesson-text" key={index}>{block.title && <h2>{block.title}</h2>}<RichText value={block.text}/></div>;
    return null;
  })}</div>;
}
