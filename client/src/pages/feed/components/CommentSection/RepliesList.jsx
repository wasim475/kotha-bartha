import { ExpandMore } from "@mui/icons-material";

import ReplyItem from "./ReplyItem";

/**
 * The branch/connector line for a comment's replies: a simple flex column
 * with a left border, not absolute positioning — so it wraps naturally
 * with long text and never causes horizontal overflow on narrow screens.
 * Only one reply shows at first; the rest stay behind "Show all replies"
 * until expanded (per-thread, driven by CommentSection).
 */
const RepliesList = ({ replies, postAuthorId, renderReply, expanded, onExpand }) => {
  const visible = expanded ? replies : replies.slice(0, 1);
  const hiddenCount = replies.length - visible.length;

  return (
    <div className="mt-3 flex flex-col gap-3 border-l-2 border-line pl-3 sm:pl-4">
      {visible.map((reply) => (
        <ReplyItem key={reply.id} entry={reply} postAuthorId={postAuthorId} {...renderReply(reply)} />
      ))}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={onExpand}
          className="inline-flex h-8 w-fit items-center gap-1 self-start rounded-full border border-line bg-panel px-3 text-[11px] font-semibold text-ink transition-colors motion-safe:duration-150 hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ExpandMore fontSize="small" />
          Show all replies
        </button>
      )}
    </div>
  );
};

export default RepliesList;
