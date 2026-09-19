import { Avatar } from "../../../../utility/helpers";
import CommentActions from "./CommentActions";
import CommentEditForm from "./CommentEditForm";
import CommentMenu from "./CommentMenu";
import CommentReply from "./CommentReply";

const CommentItem = ({
  entry,
  postAuthorId,
  editing,
  editBody,
  onEditBodyChange,
  onSaveEdit,
  onCancelEdit,
  reactionOpen,
  onToggleReaction,
  onReact,
  onReply,
  replyOpen,
  replyBody,
  onReplyBodyChange,
  onSubmitReply,
  onCancelReply,
  menuOpen,
  onToggleMenu,
  onEdit,
  onDelete,
  replies,
  renderReply,
}) => (
  <div className="comment">
    <Avatar person={entry.author} />
    <div
      className={entry.author.id === postAuthorId ? "comment-post-author" : ""}
    >
      <strong>{entry.author.fullName}</strong>
      {editing ? (
        <CommentEditForm
          value={editBody}
          onChange={onEditBodyChange}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
        />
      ) : (
        <p>{entry.body}</p>
      )}
      <CommentActions
        reaction={entry.reaction}
        reactions={entry.reactions}
        reactionOpen={reactionOpen}
        onToggleReaction={onToggleReaction}
        onReact={onReact}
        onReply={onReply}
        menu={
          entry.editable ? (
            <CommentMenu
              open={menuOpen}
              onToggle={onToggleMenu}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ) : null
        }
      />
      {replyOpen && (
        <CommentReply
          authorName={entry.author.fullName}
          value={replyBody}
          onChange={onReplyBodyChange}
          onSubmit={onSubmitReply}
          onCancel={onCancelReply}
        />
      )}
    </div>
    {replies.length > 0 && (
      <div className="comment-replies">{replies.map(renderReply)}</div>
    )}
  </div>
);

export default CommentItem;
