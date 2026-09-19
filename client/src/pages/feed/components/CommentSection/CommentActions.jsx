import { ThumbUpAlt } from "@mui/icons-material";
import CommentReaction from "./CommentReaction";
import ReactionPicker from "./ReactionPicker";
import ReactionSummary from "./ReactionSummary";

const CommentActions = ({
  reaction,
  reactions,
  reactionOpen,
  onToggleReaction,
  onReact,
  onReply,
  menu,
}) => (
  <div className="comment-actions">
    <div className="reaction-menu">
      <button
        type="button"
        className="reaction-trigger"
        aria-label="React to comment"
        title="React to comment"
        onClick={onToggleReaction}
      >
        {reaction ? (
          <CommentReaction type={reaction} />
        ) : (
          <ThumbUpAlt fontSize="small" />
        )}
      </button>
      {reactionOpen && <ReactionPicker onSelect={onReact} />}
    </div>
    <ReactionSummary reactions={reactions} />
    <button type="button" className="comment-reply-button" onClick={onReply}>
      Reply
    </button>
    {menu}
  </div>
);

export default CommentActions;
