import {
  Delete,
  Edit,
  EmojiEmotions,
  MoreVert,
  Reply,
} from "@mui/icons-material";
import EmojiPicker from "emoji-picker-react";

const MessageBubble = ({
  message,
  isOwn,
  isEditing,
  isDeleting,
  openMenu,
  editBody,
  editLoading,
  setEditBody,
  onToggleMenu,
  onEdit,
  onDelete,
  onCancelEdit,
  onSaveEdit,
  onReply,
  onReact,
  selected,
  emojiOpen,
  onSelectMessage,
  onOpenEmoji,
  onCloseInteraction,
}) => {
  return (
    <div className={`message-row ${isOwn ? "own" : ""}`}>
      {/* Editing */}
      {isEditing ? (
        <div className="message-edit-box">
          <input
            value={editBody}
            onChange={(event) => setEditBody(event.target.value)}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSaveEdit(message.id);
              }

              if (event.key === "Escape") {
                onCancelEdit();
              }
            }}
          />

          <div className="message-edit-actions">
            <button
              type="button"
              className="outline-button small"
              onClick={onCancelEdit}
              disabled={editLoading}
            >
              Cancel
            </button>

            <button
              type="button"
              className="primary-button small"
              onClick={() => onSaveEdit(message.id)}
              disabled={editLoading || !editBody.trim()}
            >
              {editLoading ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`message-bubble ${isOwn ? "own" : ""}`}
          onClick={() => onSelectMessage(message.id)}
        >
          {message.replyTo && (
            <div className="message-reply-preview">{message.replyTo.body}</div>
          )}

          {message.body}

          {message.editedAt && <small className="edited-label">edited</small>}

          {message.pending && (
            <small className="pending-label">Sending...</small>
          )}

          {isOwn && !message.pending && (
            <small
              className={`message-status status-${message.status || "sent"}`}
            >
              {message.status === "read"
                ? ""
                : message.status === "delivered"
                  ? "✓✓"
                  : "✓"}
            </small>
          )}

          {message.reactions?.length > 0 && (
            <div className="message-reactions">
              {message.reactions.map((reaction) => (
                <span key={`${reaction.userId}-${reaction.emoji}`}>
                  {reaction.emoji}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {!isEditing && selected && (
        <div
          className="message-interaction"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="message-interaction-button"
            aria-label="Reply to message"
            title="Reply to message"
            onClick={() => {
              onCloseInteraction();
              onReply(message);
            }}
          >
            <Reply fontSize="small" /> Reply
          </button>

          <div className="message-reaction-control">
            <button
              type="button"
              className="message-interaction-button"
              aria-label="React to message"
              title="React to message"
              onClick={onOpenEmoji}
            >
              <EmojiEmotions fontSize="small" /> Emoji
            </button>

            {emojiOpen && (
              <div className="message-reaction-picker">
                <EmojiPicker
                  onEmojiClick={(emojiData) => {
                    onCloseInteraction();
                    onReact(message.id, emojiData.emoji);
                  }}
                  width={280}
                  height={360}
                  searchDisabled
                  previewConfig={{ showPreview: false }}
                  lazyLoadEmojis
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Message Menu */}
      {isOwn && (
        <div className="message-menu-wrapper">
          <button
            type="button"
            className="message-menu-button"
            aria-label="Message options"
            title="Message options"
            onClick={(event) => {
              event.stopPropagation();
              onToggleMenu(message.id);
            }}
          >
            <MoreVert />
          </button>

          {openMenu === message.id && (
            <div className="message-menu">
              <button
                type="button"
                className="message-menu-item edit-item"
                aria-label="Edit message"
                title="Edit message"
                onClick={() => onEdit(message)}
              >
                <Edit fontSize="small" />
              </button>

              <button
                type="button"
                className="message-menu-item delete-item"
                aria-label={isDeleting ? "Deleting message" : "Delete message"}
                title={isDeleting ? "Deleting message" : "Delete message"}
                onClick={() => onDelete(message.id)}
                disabled={isDeleting}
              >
                <Delete fontSize="small" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
