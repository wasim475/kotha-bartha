import ReactionButton from "../../../../components/ui/reactions/ReactionButton";
import ReactionSummary from "../../../../components/ui/reactions/ReactionSummary";
import { REACTION_TYPES } from "../../../../components/ui/reactions/reactionTypes";

const CommentActions = ({ reaction, reactions, onReact, onReply, menu }) => (
  <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1">
    <ReactionButton
      value={reaction}
      onChange={onReact}
      types={REACTION_TYPES}
      size="sm"
      label="React to this comment"
    />

    <button
      type="button"
      onClick={onReply}
      className="inline-flex h-8 items-center rounded-md px-2 text-xs font-semibold text-muted transition-colors motion-safe:duration-150 hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      Reply
    </button>

    <ReactionSummary reactions={reactions} className="ml-1" />

    {menu && <div className="ml-auto">{menu}</div>}
  </div>
);

export default CommentActions;
