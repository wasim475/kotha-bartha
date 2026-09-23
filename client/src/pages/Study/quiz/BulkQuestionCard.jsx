import { Close, Delete, ExpandMore, Image as ImageIcon } from "@mui/icons-material";
import { useRef, useState } from "react";

import IconButton from "../../../components/ui/IconButton";
import { cx } from "../../../utility/cx";

const OPTION_LABELS = ["A", "B", "C", "D"];
const MAX_QUESTION_IMAGES = 4;

/**
 * One editable row in the bulk-parse preview list. Collapsed by default
 * (a batch can be 30-90 questions — expanding all of them at once would
 * be unusable) showing just the question text and its correct answer;
 * expands to the same question/options/radio/image-picker UI as the
 * single-question form, scoped to this one question, so fixing a
 * mis-parsed question never requires re-pasting the whole batch.
 */
export default function BulkQuestionCard({ item, index, onChange, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const imageInputRef = useRef(null);

  const updateField = (field, value) => onChange({ ...item, [field]: value });
  const updateOption = (position, value) => {
    const options = item.options.slice();
    options[position] = value;
    onChange({ ...item, options });
  };

  const addImages = (files) => {
    if (!files.length) return;
    const remaining = MAX_QUESTION_IMAGES - item.images.length;
    if (remaining <= 0) return;
    const accepted = files.slice(0, remaining).map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    onChange({ ...item, images: [...item.images, ...accepted] });
  };

  const removeImage = (imageIndex) => {
    const target = item.images[imageIndex];
    if (target) URL.revokeObjectURL(target.previewUrl);
    onChange({ ...item, images: item.images.filter((_, i) => i !== imageIndex) });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setExpanded((current) => !current);
          }
        }}
        className="flex cursor-pointer items-center gap-2.5 p-3 transition-colors motion-safe:duration-150 hover:bg-soft"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-soft text-[11px] font-bold text-muted">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{item.question || <em className="text-muted">Empty question</em>}</p>
          <p className="text-[11px] text-muted">
            Correct: <span className="font-semibold text-green-600 dark:text-green-400">{OPTION_LABELS[item.correctIndex]}</span>
            {item.images.length > 0 && ` · ${item.images.length} image${item.images.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <IconButton
          label="Remove question"
          icon={<Delete fontSize="small" />}
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            item.images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
            onDelete();
          }}
        />
        <ExpandMore
          fontSize="small"
          className={cx("shrink-0 text-muted transition-transform motion-safe:duration-200", expanded && "rotate-180")}
        />
      </div>

      <div
        className={cx(
          "grid transition-[grid-template-rows] motion-safe:duration-300 ease-in-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-3 border-t border-line p-3">
            <div>
              <label className="text-[10px] font-semibold tracking-wide text-muted uppercase">Question</label>
              <textarea
                value={item.question}
                onChange={(event) => updateField("question", event.target.value)}
                rows={2}
                maxLength={1000}
                className="mt-1 w-full resize-none rounded-md border border-line bg-paper p-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>

            <div className="grid gap-2" role="radiogroup" aria-label={`Correct answer for question ${index + 1}`}>
              {item.options.map((optionValue, position) => {
                const isCorrect = item.correctIndex === position;
                return (
                  <div
                    key={position}
                    onClick={() => updateField("correctIndex", position)}
                    className={cx(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors motion-safe:duration-150",
                      isCorrect ? "border-green-500 bg-green-500/10" : "border-line bg-paper hover:border-accent",
                    )}
                  >
                    <input
                      type="radio"
                      name={`bulk-correct-${index}`}
                      checked={isCorrect}
                      onChange={() => updateField("correctIndex", position)}
                      aria-label={`Mark option ${OPTION_LABELS[position]} as correct`}
                      className="size-4 shrink-0 cursor-pointer accent-green-600 dark:accent-green-400"
                    />
                    <span
                      className={cx(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
                        isCorrect ? "border-green-500 bg-green-500 text-white" : "border-line text-muted",
                      )}
                    >
                      {OPTION_LABELS[position]}
                    </span>
                    <input
                      value={optionValue}
                      onChange={(event) => updateOption(position, event.target.value)}
                      onClick={(event) => event.stopPropagation()}
                      maxLength={300}
                      className="min-w-0 flex-1 rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    />
                  </div>
                );
              })}
            </div>

            <div>
              {item.images.length > 0 && (
                <div className="mb-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                  {item.images.map((image, imageIndex) => (
                    <div key={image.previewUrl} className="relative aspect-square overflow-hidden rounded-md border border-line bg-soft">
                      <img src={image.previewUrl} alt="" className="size-full object-cover" />
                      <button
                        type="button"
                        aria-label="Remove image"
                        onClick={() => removeImage(imageIndex)}
                        className="absolute top-0.5 right-0.5 flex size-4.5 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                      >
                        <Close style={{ fontSize: 12 }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={item.images.length >= MAX_QUESTION_IMAGES}
                  className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1.5 text-[11px] font-semibold text-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ImageIcon style={{ fontSize: 14 }} />
                  Add images
                </button>
                {item.images.length > 0 && (
                  <span className="text-[10px] text-muted">
                    {item.images.length} / {MAX_QUESTION_IMAGES}
                  </span>
                )}
                <input
                  ref={imageInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    event.target.value = "";
                    addImages(files);
                  }}
                />
              </div>
              {item.images.length > 0 && (
                <input
                  value={item.imageCaption}
                  onChange={(event) => updateField("imageCaption", event.target.value)}
                  placeholder="Caption for these images (optional)"
                  maxLength={300}
                  className="mt-2 w-full rounded-md border border-line bg-paper px-2.5 py-2 text-sm text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
