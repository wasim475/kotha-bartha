import { ExpandMore } from "@mui/icons-material";

import CommentItem from "./CommentItem";

const CommentList = ({ comments, postAuthorId, user, renderComment, expanded, onExpand }) => {
  const topLevel = comments.filter((entry) => !entry.parentId);
  const visible = expanded ? topLevel : topLevel.slice(0, 1);
  const hiddenCount = topLevel.length - visible.length;

  return (
    <div className="flex flex-col gap-4">
      {visible.map((entry) => (
        <CommentItem
          key={entry.id}
          postAuthorId={postAuthorId}
          user={user}
          {...renderComment(entry)}
        />
      ))}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={onExpand}
          className="inline-flex h-10 w-fit items-center gap-1 self-start rounded-full border border-line bg-panel px-3.5 text-xs font-semibold text-ink transition-colors motion-safe:duration-150 hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ExpandMore fontSize="small" />
          Show all comments
        </button>
      )}
    </div>
  );
};

export default CommentList;
