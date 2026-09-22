import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { Close } from "@mui/icons-material";
import { useState } from "react";

import IconButton from "../../../components/ui/IconButton";
import SimpleEmojiPicker from "../../../components/ui/SimpleEmojiPicker";

/**
 * Lets either participant pick this conversation's Like emoji — the
 * quick-send emoji the message composer's Like button uses when the input
 * is empty (see MessageComposer.jsx). Picking one saves and syncs
 * immediately; there's nothing else to "confirm".
 */
export default function EmojiPackDialog({ open, currentEmoji, onClose, onSelect }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const choose = async (emojiData) => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await onSelect(emojiData.emoji);
      onClose();
    } catch (selectError) {
      setError(selectError.response?.data?.error?.message || "Couldn't save that emoji.");
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
          className="w-full max-w-sm rounded-lg border border-line bg-panel p-4 shadow-soft transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0"
        >
          <div className="flex items-center justify-between px-1">
            <div>
              <DialogTitle className="font-display text-lg font-semibold text-ink">
                Like emoji
              </DialogTitle>
              <p className="mt-0.5 text-xs text-muted">
                Currently {currentEmoji} — shared with the other person in this chat.
              </p>
            </div>
            <IconButton label="Close" icon={<Close fontSize="small" />} size="sm" onClick={onClose} />
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-line">
            <SimpleEmojiPicker onEmojiClick={choose} width="100%" height={340} />
          </div>

          {error && <p className="mt-2 px-1 text-xs font-medium text-danger">{error}</p>}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
