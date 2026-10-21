import { useEffect, useRef } from "react";
import { LESSON_TEXT_COLORS } from "./lessonMarkup";

const COLORS = Object.keys(LESSON_TEXT_COLORS);
const LABELS = { default: "Default text", red: "Red", orange: "Orange", green: "Green", blue: "Blue", purple: "Purple", highlight: "Highlight" };

export default function LessonFormatToolbar({ blockIndex, colorOpen, onFormat, onCaptureSelection, onToggleColors, onCloseColors }) {
  const paletteRef = useRef(null);
  useEffect(() => {
    if (!colorOpen) return undefined;
    const onPointerDown = (event) => {
      if (!paletteRef.current?.contains(event.target)) onCloseColors();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseColors();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [colorOpen, onCloseColors]);

  const keepEditorSelection = (event) => {
    onCaptureSelection(blockIndex);
    if (event.type === "mousedown") event.preventDefault();
  };
  const formats = [["bold", "Bold"], ["italic", "Italic"], ["underline", "Underline"], ["heading", "Heading"], ["bulleted-list", "Bulleted list"], ["numbered-list", "Numbered list"], ["link", "Link"]];

  return <div className="lesson-format-toolbar" role="group" aria-label={`Formatting for block ${blockIndex + 1}`}>
    {formats.map(([format, label]) => <button type="button" key={format} title={label} aria-label={label} onMouseDown={keepEditorSelection} onClick={() => onFormat(blockIndex, format)}>{label}</button>)}
    <div className="lesson-color-control" ref={paletteRef}>
      <button type="button" className="lesson-color-trigger" aria-label="Text color" aria-haspopup="true" aria-expanded={colorOpen} aria-controls={`lesson-color-palette-${blockIndex}`} onMouseDown={keepEditorSelection} onClick={() => onToggleColors(blockIndex)}>
        <span aria-hidden="true">A</span><i aria-hidden="true"/>
      </button>
      {colorOpen && <div className="lesson-color-palette" id={`lesson-color-palette-${blockIndex}`} role="group" aria-label="Text color palette">
        {COLORS.map((color) => <button type="button" key={color} aria-label={LABELS[color]} title={LABELS[color]} className={`lesson-color-swatch ${color === "default" ? "is-default" : ""}`} style={{ "--swatch-color": color === "default" ? "currentColor" : LESSON_TEXT_COLORS[color] }} onMouseDown={keepEditorSelection} onClick={() => { onFormat(blockIndex, `color:${color}`); onCloseColors(); }}><span>{color === "default" ? "A" : ""}</span></button>)}
      </div>}
    </div>
  </div>;
}
