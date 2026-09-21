import { cx } from "../../../utility/cx";
import ReactionIcon from "./ReactionIcons";
import { REACTION_TYPES } from "./reactionTypes";

/**
 * Compact "who reacted" summary: up to three overlapping reaction faces
 * (in canonical type order, highest-signal first) plus the total count.
 * Shared by posts, comments and replies.
 */
export default function ReactionSummary({ reactions = {}, className = "" }) {
  const present = REACTION_TYPES.filter((type) => reactions[type] > 0);
  const total = present.reduce((sum, type) => sum + reactions[type], 0);

  if (!total) return null;

  return (
    <div
      className={cx("inline-flex items-center gap-1.5", className)}
      aria-label={`${total} reaction${total === 1 ? "" : "s"}`}
    >
      <span className="flex items-center -space-x-1">
        {present.slice(0, 3).map((type) => (
          <span
            key={type}
            className="flex size-4 items-center justify-center rounded-full ring-2 ring-panel"
          >
            <ReactionIcon type={type} className="size-4" />
          </span>
        ))}
      </span>
      <span className="text-xs font-semibold text-muted">{total}</span>
    </div>
  );
}
