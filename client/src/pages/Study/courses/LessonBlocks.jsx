import { parseInlineLessonText, parseLessonMarkup } from "./lessonMarkup";

function InlineText({ value }) {
  return parseInlineLessonText(value).map((part, index) => {
    if (part.type === "bold") return <strong key={index}>{part.text}</strong>;
    if (part.type === "italic") return <em key={index}>{part.text}</em>;
    if (part.type === "underline") return <u key={index}>{part.text}</u>;
    if (part.type === "link") return <a key={index} href={part.href} target="_blank" rel="noreferrer">{part.text}</a>;
    return <span key={index}>{part.text}</span>;
  });
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
