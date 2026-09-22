import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { Close } from "@mui/icons-material";
import { useState } from "react";

import Button from "../../../components/ui/Button";
import IconButton from "../../../components/ui/IconButton";

const MAX_LENGTH = 150;

/**
 * Short-text Note composer — a lighter cousin of StoryComposerDialog.jsx
 * (text-only, no colors/photo), matching the Facebook-style "Notes" idea:
 * a short thought that shows up in the same story area for 24 hours.
 */
export default function NoteComposerDialog({ open, onClose, onCreate }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [trackedOpen, setTrackedOpen] = useState(open);
  if (open !== trackedOpen) {
    setTrackedOpen(open);
    if (open) {
      setText("");
      setError("");
    }
  }

  const submit = async () => {
    const value = text.trim();
    if (!value || saving) return;
    setSaving(true);
    setError("");
    try {
      await onCreate(value);
      onClose();
    } catch (submitError) {
      setError(submitError.response?.data?.error?.message || "Couldn't post your note.");
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
              Create note
            </DialogTitle>
            <IconButton label="Close" icon={<Close fontSize="small" />} size="sm" onClick={onClose} />
          </div>

          <div className="p-4">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, MAX_LENGTH))}
              autoFocus
              placeholder="What's on your mind?"
              rows={3}
              className="w-full resize-none rounded-xl border border-line bg-paper p-3 text-sm text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
            />
            <p className="mt-1.5 text-right text-[11px] text-muted">
              {text.length}/{MAX_LENGTH}
            </p>

            {error && <p className="text-xs font-medium text-danger">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 border-t border-line p-3">
            <Button variant="ghost" size="sm" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              disabled={!text.trim() || saving}
              onClick={submit}
            >
              Share note
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
