import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";

import useButtonColorFix from "../../utility/useButtonColorFix";
import Button from "./Button";

/**
 * A blocking yes/no confirmation for destructive or hard-to-undo actions
 * (Unfriend, Block, ...). Built on Headless UI's Dialog (already a
 * dependency via Menu/Popover) rather than a new modal package.
 *
 * `loading` disables both buttons and shows a spinner on Confirm, so the
 * caller has one place to guard against a double-confirm firing the action
 * twice while the request is in flight.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  loading = false,
  onConfirm,
  onCancel,
}) {
  const confirmFix = useButtonColorFix(variant);

  return (
    <Dialog
      open={open}
      onClose={() => !loading && onCancel()}
      className="relative z-50"
    >
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
            {title}
          </DialogTitle>
          {description && (
            <p className="mt-2 text-sm text-muted">{description}</p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button
              size="sm"
              variant={variant}
              loading={loading}
              disabled={loading}
              onClick={onConfirm}
              style={confirmFix.style}
              onMouseEnter={confirmFix.onMouseEnter}
              onMouseLeave={confirmFix.onMouseLeave}
            >
              {confirmLabel}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
