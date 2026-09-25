import { Link } from "react-router-dom";

import ProfileAvatarLink from "../../../../components/ui/ProfileAvatarLink";
import RichText from "../../../../components/ui/RichText";
import { cx } from "../../../../utility/cx";
import CommentActions from "./CommentActions";
import CommentEditForm from "./CommentEditForm";
import CommentMenu from "./CommentMenu";
import ReportMenu from "../../../../components/report/ReportMenu";
import CommentReply from "./CommentReply";
import RepliesList from "./RepliesList";

const CommentItem = ({
  entry,
  postAuthorId,
  user,
  highlighted,
  editing,
  editBody,
  onEditBodyChange,
  onSaveEdit,
  onCancelEdit,
  onReact,
  onReply,
  replyOpen,
  replyTargetName,
  replyBody,
  onReplyBodyChange,
  onSubmitReply,
  onCancelReply,
  replySubmitting,
  replyEmojiOpen,
  onToggleReplyEmoji,
  onReplyEmoji,
  onEdit,
  onDelete,
  replies,
  renderReply,
  repliesExpanded,
  onExpandReplies,
}) => (
  <div
    id={`comment-${entry.id}`}
    className={cx(
      "flex gap-3 rounded-xl p-1 -m-1 transition-colors motion-safe:duration-500",
      highlighted && "bg-accent/15 ring-2 ring-accent",
    )}
  >
    <ProfileAvatarLink person={entry.author} size="sm" className="mt-0.5 shrink-0 rounded-full" />

    <div className="min-w-0 flex-1">
      <div
        className={
          "min-w-0 rounded-2xl px-3.5 py-2.5 " +
          (entry.author.id === postAuthorId ? "bg-accent/10" : "bg-soft")
        }
      >
        <div className="flex items-start justify-between gap-2">
          <Link to={`/app/profile/${entry.author.id}`} className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink hover:underline">
              {entry.author.fullName}
            </p>
          </Link>
          {entry.editable ? <CommentMenu onEdit={onEdit} onDelete={onDelete} /> : <ReportMenu targetType="comment" targetId={entry.id} />}
        </div>

        {editing ? (
          <CommentEditForm
            value={editBody}
            onChange={onEditBodyChange}
            onSave={onSaveEdit}
            onCancel={onCancelEdit}
          />
        ) : (
          <p className="min-w-0 wrap-break-word text-sm leading-relaxed text-ink">
            <RichText text={entry.body} />
          </p>
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

      {replyOpen && (
        <CommentReply
          user={user}
          authorName={replyTargetName}
          value={replyBody}
          onChange={onReplyBodyChange}
          onSubmit={onSubmitReply}
          onCancel={onCancelReply}
          submitting={replySubmitting}
          emojiOpen={replyEmojiOpen}
          onToggleEmoji={onToggleReplyEmoji}
          onEmoji={onReplyEmoji}
        />
      )}

      {replies.length > 0 && (
        <RepliesList
          replies={replies}
          postAuthorId={postAuthorId}
          renderReply={renderReply}
          expanded={repliesExpanded}
          onExpand={onExpandReplies}
        />
      )}
    </div>
  </div>
);

export default CommentItem;
