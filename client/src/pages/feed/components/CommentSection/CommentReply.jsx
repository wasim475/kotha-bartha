import { Close, Send } from "@mui/icons-material";

import Avatar from "../../../../components/ui/Avatar";
import Spinner from "../../../../components/ui/Spinner";
import EmojiPickerButton from "./EmojiPickerButton";

const CommentReply = ({
  user,
  authorName,
  value,
  onChange,
  onSubmit,
  onCancel,
  submitting = false,
  emojiOpen,
  onToggleEmoji,
  onEmoji,
}) => (
  <form onSubmit={onSubmit} className="mt-2 flex items-start gap-2">
    <Avatar person={user} size="xs" className="mt-1 shrink-0" />

    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-accent">
        Replying to {authorName}
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel reply"
          className="-my-1.5 inline-flex size-6 items-center justify-center rounded-full text-muted transition-colors motion-safe:duration-150 hover:bg-soft hover:text-ink"
        >
          <Close style={{ fontSize: 13 }} />
        </button>
      </div>

      <div className="flex items-center gap-1 rounded-full border border-line bg-panel pl-3 pr-1.5">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Write a reply..."
          autoFocus
          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-ink outline-none placeholder:text-muted"
        />
        <EmojiPickerButton open={emojiOpen} onToggle={onToggleEmoji} onEmoji={onEmoji} />
        <button
          type="submit"
          disabled={!value.trim() || submitting}
          aria-label="Post reply"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-accent transition-colors motion-safe:duration-150 hover:bg-soft disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {submitting ? <Spinner size="xs" /> : <Send fontSize="small" />}
        </button>
      </div>
    </div>
  </form>
);

export default CommentReply;
