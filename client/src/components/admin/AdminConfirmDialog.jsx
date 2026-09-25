import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { useState } from "react";

import AdminButton from "./AdminButton";

/**
 * Explicit confirmation for anything destructive (delete, ban, mute, role change…).
 * Optional reason box, and — for the most dangerous actions — a word the admin
 * must type before the button enables. The action runs only from the confirm
 * button, never from the click that opened the dialog.
 */
export default function AdminConfirmDialog({ open, title, description, confirmLabel = "Confirm", variant = "primary", reasonLabel, typedWord, busy, error, onConfirm, onCancel }) {
  return (
    <Dialog open={open} onClose={() => !busy && onCancel()} className="relative z-50">
      <DialogBackdrop transition className="fixed inset-0 bg-black/45 transition-opacity duration-150 data-[closed]:opacity-0" />
      <div className="fixed inset-0 flex items-end justify-center p-3 sm:items-center sm:p-4">
        {/* Keyed on `open` so the fields reset every time the dialog is opened. */}
        {open && <Body {...{ title, description, confirmLabel, variant, reasonLabel, typedWord, busy, error, onConfirm, onCancel }} />}
      </div>
    </Dialog>
  );
}

function Body({ title, description, confirmLabel, variant, reasonLabel, typedWord, busy, error, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const ready = !typedWord || typed.trim().toUpperCase() === typedWord.toUpperCase();

  return (
    <DialogPanel transition className="w-full max-w-sm rounded-xl border border-line bg-panel p-5 shadow-soft transition duration-150 data-[closed]:translate-y-3 data-[closed]:opacity-0" data-testid="admin-confirm">
      <DialogTitle className="font-display text-lg font-semibold text-ink">{title}</DialogTitle>
      {description && <p className="mt-2 text-sm text-muted">{description}</p>}

      {reasonLabel && (
        <label className="mt-3 block text-xs font-semibold text-muted">
          {reasonLabel}
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={300}
            rows={2}
            className="mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>
      )}
      {typedWord && (
        <label className="mt-3 block text-xs font-semibold text-muted">
          Type {typedWord} to confirm
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            className="mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs font-medium text-danger">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <AdminButton variant="ghost" className="min-h-10" onClick={onCancel} disabled={busy}>
          Cancel
        </AdminButton>
        <AdminButton variant={variant} className="min-h-10" loading={busy} disabled={busy || !ready} onClick={() => onConfirm(reason.trim())}>
          {confirmLabel}
        </AdminButton>
      </div>
    </DialogPanel>
  );
}
