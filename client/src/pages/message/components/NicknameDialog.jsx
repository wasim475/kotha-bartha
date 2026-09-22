import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { useState } from "react";

import Button from "../../../components/ui/Button";
import useButtonColorFix from "../../../utility/useButtonColorFix";

export default function NicknameDialog({ open, currentNickname, personName, onClose, onSave }) {
  const [value, setValue] = useState(currentNickname || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const primaryFix = useButtonColorFix("primary");

  // Reset the draft to whatever's currently saved each time the dialog is
  // freshly opened — a render-time state adjustment (not an effect, so it
  // doesn't need queuing to dodge react-hooks/set-state-in-effect).
  const [trackedOpen, setTrackedOpen] = useState(open);
  if (open !== trackedOpen) {
    setTrackedOpen(open);
    if (open) {
      setValue(currentNickname || "");
      setError("");
    }
  }

  const save = async (nextValue) => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave(nextValue);
      onClose();
    } catch (saveError) {
      setError(saveError.response?.data?.error?.message || "Couldn't save the nickname.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/40 transition-opacity duration-150 data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="w-full max-w-sm rounded-lg border border-line bg-panel p-5 shadow-soft transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0"
        >
          <DialogTitle className="font-display text-lg font-semibold text-ink">
            Set nickname
          </DialogTitle>
          <p className="mt-1 text-xs text-muted">
            Only you will see this nickname for {personName}.
          </p>

          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
            maxLength={40}
            placeholder={personName}
            disabled={saving}
            className="mt-3.5 w-full rounded-md border border-line bg-paper px-2.5 py-2 text-sm text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
            onKeyDown={(event) => {
              if (event.key === "Enter") save(value.trim());
            }}
          />

          {error && <p className="mt-2 text-xs font-medium text-danger">{error}</p>}

          <div className="mt-4 flex items-center justify-between gap-2">
            {currentNickname ? (
              <Button variant="ghost" size="sm" disabled={saving} onClick={() => save("")}>
                Remove
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={saving} onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                loading={saving}
                disabled={saving}
                onClick={() => save(value.trim())}
                style={primaryFix.style}
                onMouseEnter={primaryFix.onMouseEnter}
                onMouseLeave={primaryFix.onMouseLeave}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
