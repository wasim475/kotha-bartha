import { Send } from "@mui/icons-material";

import Avatar from "../../../../components/ui/Avatar";
import Spinner from "../../../../components/ui/Spinner";
import EmojiPickerButton from "./EmojiPickerButton";

const CommentForm = ({
  user,
  value,
  onChange,
  onSubmit,
  submitting = false,
  emojiOpen,
  onToggleEmoji,
  onEmoji,
  placeholder = "Write a comment...",
}) => (
  <form onSubmit={onSubmit} className="flex items-center gap-2">
    <Avatar person={user} size="xs" className="shrink-0" />

    <div className="flex min-w-0 flex-1 items-center gap-1 rounded-full border border-line bg-panel pl-3 pr-1.5">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent py-2 text-sm text-ink outline-none placeholder:text-muted"
      />
      <EmojiPickerButton open={emojiOpen} onToggle={onToggleEmoji} onEmoji={onEmoji} />
      <button
        type="submit"
        disabled={!value.trim() || submitting}
        aria-label="Post comment"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-accent transition-colors motion-safe:duration-150 hover:bg-soft disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {submitting ? <Spinner size="xs" /> : <Send fontSize="small" />}
      </button>
    </div>
  </form>
);

export default CommentForm;
