import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";

import useButtonColorFix from "../../../utility/useButtonColorFix";
import Button from "../../../components/ui/Button";

// Offers "delete for me" (always available, any message) and, only for the
// sender's own message inside the unsend window, "delete for everyone".
export default function DeleteMessageDialog({
  open,
  canDeleteForEveryone,
  loading,
  onDeleteForMe,
  onDeleteForEveryone,
  onCancel,
}) {
  const dangerFix = useButtonColorFix("danger");

  return (
    <Dialog open={open} onClose={() => !loading && onCancel()} className="relative z-50">
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
            Delete message
          </DialogTitle>
          <p className="mt-2 text-sm text-muted">
            {canDeleteForEveryone
              ? "Remove this message just for you, or for everyone in the conversation."
              : "This removes the message from your view only."}
          </p>

          <div className="mt-5 flex flex-col gap-2">
            {canDeleteForEveryone && (
              <Button
                size="sm"
                variant="danger"
                loading={loading}
                disabled={loading}
                onClick={onDeleteForEveryone}
                style={dangerFix.style}
                onMouseEnter={dangerFix.onMouseEnter}
                onMouseLeave={dangerFix.onMouseLeave}
              >
                Delete for everyone
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              loading={loading}
              disabled={loading}
              onClick={onDeleteForMe}
            >
              Delete for me
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
