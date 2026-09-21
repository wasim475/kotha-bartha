import Avatar from "../../../../components/ui/Avatar";
import { cx } from "../../../../utility/cx";
import CommentActions from "./CommentActions";
import CommentEditForm from "./CommentEditForm";
import CommentMenu from "./CommentMenu";

/**
 * One reply in a flattened thread. Visually every reply sits at the same
 * indentation under its top-level comment (see the approved "flatten to
 * one visual level" decision) — a reply that actually targets another
 * reply just carries a small "Replying to @name" tag instead of nesting
 * further, so long threads never run away with indentation on mobile.
 */
const ReplyItem = ({
  entry,
  postAuthorId,
  highlighted,
  replyingToName,
  editing,
  editBody,
  onEditBodyChange,
  onSaveEdit,
  onCancelEdit,
  onReact,
  onReply,
  onEdit,
  onDelete,
}) => (
  <div
    id={`comment-${entry.id}`}
    className={cx(
      "flex gap-2.5 rounded-xl p-1 -m-1 transition-colors motion-safe:duration-500",
      highlighted && "bg-accent/15 ring-2 ring-accent",
    )}
  >
    <Avatar person={entry.author} size="xs" className="mt-0.5 shrink-0" />

    <div className="min-w-0 flex-1">
      <div
        className={
          "min-w-0 rounded-2xl px-3 py-2 " +
          (entry.author.id === postAuthorId ? "bg-accent/10" : "bg-soft")
        }
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-semibold text-ink">{entry.author.fullName}</p>
          {entry.editable && <CommentMenu onEdit={onEdit} onDelete={onDelete} />}
        </div>

        {replyingToName && (
          <p className="text-[11px] font-medium text-accent">Replying to {replyingToName}</p>
        )}

        {editing ? (
          <CommentEditForm
            value={editBody}
            onChange={onEditBodyChange}
            onSave={onSaveEdit}
            onCancel={onCancelEdit}
          />
        ) : (
          <p className="min-w-0 wrap-break-word text-[13px] leading-relaxed text-ink">{entry.body}</p>
        )}
      </div>

      {!editing && (
        <CommentActions
          reaction={entry.reaction}
          reactions={entry.reactions}
          onReact={onReact}
          onReply={onReply}
        />
      )}
    </div>
  </div>
);

export default ReplyItem;
