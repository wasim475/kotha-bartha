import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { Close } from "@mui/icons-material";
import { useState } from "react";

import Button from "../../../components/ui/Button";
import IconButton from "../../../components/ui/IconButton";

/**
 * Small "add a name" modal shared by "+ Add Subject" and "+ Add Chapter"
 * in QuizAdmin.jsx — same shape, just a different title/placeholder/submit
 * handler.
 */
export default function AddNameDialog({ open, title, placeholder, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [trackedOpen, setTrackedOpen] = useState(open);
  if (open !== trackedOpen) {
    setTrackedOpen(open);
    if (open) {
      setName("");
      setError("");
    }
  }

  const submit = async (event) => {
    event.preventDefault();
    const value = name.trim();
    if (!value || saving) return;
    setSaving(true);
    setError("");
    try {
      await onCreate(value);
      onClose();
    } catch (submitError) {
      setError(submitError.response?.data?.error?.message || "Couldn't save that.");
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
          className="w-full max-w-sm rounded-lg border border-line bg-panel shadow-soft transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <DialogTitle className="font-display text-base font-semibold text-ink">
              {title}
            </DialogTitle>
            <IconButton label="Close" icon={<Close fontSize="small" />} size="sm" onClick={onClose} />
          </div>

          <form onSubmit={submit} className="p-4">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              placeholder={placeholder}
              maxLength={120}
              className="w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
            />
            {error && <p className="mt-2 text-xs font-medium text-danger">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" type="button" disabled={saving} onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={saving} disabled={!name.trim() || saving}>
                Save
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
