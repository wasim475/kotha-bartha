import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { Close, Image as ImageIcon, TextFields } from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";

import Button from "../../../components/ui/Button";
import IconButton from "../../../components/ui/IconButton";
import { cx } from "../../../utility/cx";

const BACKGROUND_COLORS = [
  "#e96449",
  "#2f7bbf",
  "#3f8f5f",
  "#7c5cbf",
  "#d5527a",
  "#55606e",
  "#c39b57",
];
const TEXT_COLORS = ["#ffffff", "#171716", "#f4e04d"];

/**
 * Creates a text or image story. Text stories pick a background + text
 * color and type directly into a live preview; image stories upload a
 * photo (existing Cloudinary pipeline, via useStories' createStory ->
 * POST /stories) with an optional short caption overlay.
 */
export default function StoryComposerDialog({ open, onClose, onCreate }) {
  const [mode, setMode] = useState("text");
  const [text, setText] = useState("");
  const [textColor, setTextColor] = useState(TEXT_COLORS[0]);
  const [backgroundColor, setBackgroundColor] = useState(BACKGROUND_COLORS[0]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  // Reset the composer back to a blank slate each time it's freshly
  // opened — render-time state adjustment, not an effect.
  const [trackedOpen, setTrackedOpen] = useState(open);
  if (open !== trackedOpen) {
    setTrackedOpen(open);
    if (open) {
      setMode("text");
      setText("");
      setTextColor(TEXT_COLORS[0]);
      setBackgroundColor(BACKGROUND_COLORS[0]);
      setImageFile(null);
      setError("");
    }
  }

  useEffect(() => {
    if (!imageFile) {
      queueMicrotask(() => setImagePreviewUrl(null));
      return undefined;
    }
    const url = URL.createObjectURL(imageFile);
    queueMicrotask(() => setImagePreviewUrl(url));
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const canSubmit = mode === "text" ? Boolean(text.trim()) : Boolean(imageFile);

  const submit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("type", mode);
      formData.append("text", text.trim());
      formData.append("textColor", textColor);
      if (mode === "text") {
        formData.append("backgroundColor", backgroundColor);
      } else {
        formData.append("file", imageFile);
      }
      await onCreate(formData);
      onClose();
    } catch (submitError) {
      setError(submitError.response?.data?.error?.message || "Couldn't post your story.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/50 transition-opacity duration-150 data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="flex w-full max-w-sm flex-col rounded-lg border border-line bg-panel shadow-soft transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <DialogTitle className="font-display text-base font-semibold text-ink">
              Create story
            </DialogTitle>
            <IconButton label="Close" icon={<Close fontSize="small" />} size="sm" onClick={onClose} />
          </div>

          <div className="flex gap-1 p-3 pb-0">
            <button
              type="button"
              onClick={() => setMode("text")}
              className={cx(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold transition-colors",
                mode === "text" ? "bg-accent text-white" : "bg-soft text-muted hover:text-ink",
              )}
            >
              <TextFields fontSize="small" /> Text
            </button>
            <button
              type="button"
              onClick={() => setMode("image")}
              className={cx(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold transition-colors",
                mode === "image" ? "bg-accent text-white" : "bg-soft text-muted hover:text-ink",
              )}
            >
              <ImageIcon fontSize="small" /> Photo
            </button>
          </div>

          <div className="p-4">
            {mode === "text" ? (
              <div
                className="flex h-64 items-center justify-center rounded-xl p-4"
                style={{ backgroundColor }}
              >
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value.slice(0, 500))}
                  autoFocus
                  placeholder="Type your story…"
                  rows={4}
                  className="w-full resize-none bg-transparent text-center text-xl font-semibold outline-none placeholder:opacity-70"
                  style={{ color: textColor }}
                />
              </div>
            ) : imagePreviewUrl ? (
              <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-xl bg-black">
                <img src={imagePreviewUrl} alt="Selected" className="max-h-full max-w-full object-contain" />
                {text && (
                  <span
                    className="absolute inset-x-3 bottom-3 text-center text-sm font-semibold"
                    style={{ color: textColor }}
                  >
                    {text}
                  </span>
                )}
                <IconButton
                  label="Choose a different image"
                  icon={<ImageIcon fontSize="small" />}
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute top-2 right-2 bg-black/55 text-white hover:bg-black/70 hover:text-white"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-64 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-muted transition-colors hover:border-accent hover:text-accent"
              >
                <ImageIcon fontSize="large" />
                <span className="text-sm font-medium">Choose a photo</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) setImageFile(file);
              }}
            />

            {mode === "image" && (
              <input
                value={text}
                onChange={(event) => setText(event.target.value.slice(0, 500))}
                placeholder="Add a caption (optional)…"
                className="mt-3 w-full rounded-md border border-line bg-paper px-2.5 py-2 text-sm text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
              />
            )}

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="mr-1 text-[10px] font-semibold tracking-wide text-muted uppercase">
                  Text color
                </span>
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Text color ${color}`}
                    onClick={() => setTextColor(color)}
                    className={cx(
                      "size-6 rounded-full border-2 transition",
                      textColor === color ? "border-accent" : "border-line",
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {mode === "text" && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[10px] font-semibold tracking-wide text-muted uppercase">
                  Background
                </span>
                {BACKGROUND_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Background color ${color}`}
                    onClick={() => setBackgroundColor(color)}
                    className={cx(
                      "size-6 rounded-full border-2 transition",
                      backgroundColor === color ? "border-accent" : "border-line",
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            )}

            {error && <p className="mt-3 text-xs font-medium text-danger">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 border-t border-line p-3">
            <Button variant="ghost" size="sm" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={saving} disabled={!canSubmit || saving} onClick={submit}>
              Share to story
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
