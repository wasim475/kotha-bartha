import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { Close, Delete, Send } from "@mui/icons-material";
import { useState } from "react";

import Avatar from "../../../components/ui/Avatar";
import IconButton from "../../../components/ui/IconButton";
import { REACTION_TYPE_TO_EMOJI } from "../../../components/ui/reactions/reactionEmoji";
import { REACTION_TYPES } from "../../../components/ui/reactions/reactionTypes";
import { api } from "../../../utility/api";
import { cx } from "../../../utility/cx";
import { formatTime } from "../../../utility/helpers";

/**
 * Note viewer — a smaller cousin of StoryViewerDialog.jsx (no image/no
 * multi-item nav, since a user only ever has one active note at a time),
 * with the same reaction/reply-sends-a-DM behavior via
 * server/src/routes/notes.routes.js.
 */
export default function NoteViewerDialog({ entry, onClose, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const [reacting, setReacting] = useState(false);
  const [justReactedEmoji, setJustReactedEmoji] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [replySent, setReplySent] = useState(false);

  const { author, note, isMine } = entry;

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete(note.id);
    } finally {
      setDeleting(false);
      onClose();
    }
  };

  const react = async (emoji) => {
    if (reacting) return;
    setReacting(true);
    try {
      await api.post(`/notes/${note.id}/react`, { emoji });
      setJustReactedEmoji(emoji);
      setTimeout(() => setJustReactedEmoji(null), 1200);
    } catch {
      // best-effort
    } finally {
      setReacting(false);
    }
  };

  const sendReply = async (event) => {
    event.preventDefault();
    const text = replyText.trim();
    if (!text || sending) return;
    setSending(true);
    setReplyError("");
    try {
      await api.post(`/notes/${note.id}/reply`, { text });
      setReplyText("");
      setReplySent(true);
      setTimeout(() => setReplySent(false), 1800);
    } catch (error) {
      setReplyError(error.response?.data?.error?.message || "Couldn't send your reply.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/50 transition-opacity duration-150 data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="flex w-full max-w-sm flex-col rounded-2xl border border-line bg-panel shadow-soft transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar person={author} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{author.fullName}</p>
                <p className="text-[11px] text-muted">{formatTime(note.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isMine && (
                <IconButton
                  label="Delete note"
                  icon={<Delete fontSize="small" />}
                  size="sm"
                  disabled={deleting}
                  onClick={handleDelete}
                />
              )}
              <IconButton label="Close" icon={<Close fontSize="small" />} size="sm" onClick={onClose} />
            </div>
          </div>

          <div className="p-5">
            <p className="text-center text-lg leading-relaxed font-semibold text-ink wrap-anywhere">
              {note.text}
            </p>
          </div>

          {!isMine && (
            <div className="flex flex-col gap-2 border-t border-line p-3">
              <div className="flex items-center justify-center gap-2">
                {REACTION_TYPES.map((type) => {
                  const emoji = REACTION_TYPE_TO_EMOJI[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-label={`React ${emoji}`}
                      onClick={() => react(emoji)}
                      disabled={reacting}
                      className={cx(
                        "flex size-9 items-center justify-center rounded-full bg-soft text-lg transition-transform motion-safe:duration-150 motion-safe:hover:-translate-y-1 motion-safe:hover:scale-110 disabled:cursor-not-allowed",
                        justReactedEmoji === emoji && "scale-110 ring-2 ring-accent",
                      )}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>

              <form onSubmit={sendReply} className="flex items-center gap-2">
                <input
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder="Reply to their note…"
                  maxLength={2000}
                  className="min-w-0 flex-1 rounded-full border border-line bg-paper px-3.5 py-2 text-sm text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || sending}
                  aria-label="Send reply"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send fontSize="small" />
                </button>
              </form>

              {(replySent || replyError) && (
                <p
                  className={cx(
                    "text-center text-xs font-medium",
                    replyError ? "text-danger" : "text-muted",
                  )}
                >
                  {replyError || "Reply sent"}
                </p>
              )}
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
