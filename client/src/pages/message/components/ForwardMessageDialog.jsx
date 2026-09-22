import { Close } from "@mui/icons-material";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { useState } from "react";

import Avatar from "../../../components/ui/Avatar";
import Button from "../../../components/ui/Button";
import IconButton from "../../../components/ui/IconButton";
import { cx } from "../../../utility/cx";
import useButtonColorFix from "../../../utility/useButtonColorFix";

// Forwards a message (or, for an encrypted message, its already-decrypted
// plaintext held by the caller) to one or more existing conversations.
export default function ForwardMessageDialog({
  open,
  message,
  conversations,
  onClose,
  onForward,
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const primaryFix = useButtonColorFix("primary");

  const toggle = (id) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const close = () => {
    if (sending) return;
    setSelectedIds([]);
    setError("");
    onClose();
  };

  const submit = async () => {
    if (!selectedIds.length || !message) return;
    setSending(true);
    setError("");
    try {
      await onForward(message, selectedIds);
      close();
    } catch (forwardError) {
      setError(forwardError.response?.data?.error?.message || "Message could not be forwarded.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/40 transition-opacity duration-150 data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="flex max-h-[80vh] w-full max-w-sm flex-col rounded-lg border border-line bg-panel shadow-soft transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <DialogTitle className="font-display text-base font-semibold text-ink">
              Forward message
            </DialogTitle>
            <IconButton label="Close" icon={<Close fontSize="small" />} size="sm" onClick={close} />
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            {(conversations || []).map((conversation) => {
              const display = conversation.isGroup
                ? { fullName: conversation.group?.name, avatar: conversation.group?.avatar }
                : conversation.user;
              const checked = selectedIds.includes(conversation.id);

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => toggle(conversation.id)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-soft"
                >
                  <Avatar person={display} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {display?.fullName || "Conversation"}
                  </span>
                  <span
                    className={cx(
                      "flex size-4 shrink-0 items-center justify-center rounded border",
                      checked ? "border-accent bg-accent" : "border-line",
                    )}
                  >
                    {checked && <span className="size-2 rounded-sm bg-white" />}
                  </span>
                </button>
              );
            })}
            {!conversations?.length && (
              <p className="px-2 py-4 text-center text-xs text-muted">No conversations to forward to.</p>
            )}
          </div>

          {error && <p className="px-4 pb-1 text-xs font-medium text-danger">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
            <Button variant="ghost" size="sm" onClick={close} disabled={sending}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={sending}
              disabled={sending || !selectedIds.length}
              onClick={submit}
              style={primaryFix.style}
              onMouseEnter={primaryFix.onMouseEnter}
              onMouseLeave={primaryFix.onMouseLeave}
            >
              Forward
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
