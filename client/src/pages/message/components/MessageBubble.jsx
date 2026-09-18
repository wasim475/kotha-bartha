import {
  Delete,
  Edit,
  EmojiEmotions,
  MoreVert,
  Reply,
} from "@mui/icons-material";
import EmojiPicker from "emoji-picker-react";
import { useState } from "react";

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
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

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
        <div className={`message-bubble ${isOwn ? "own" : ""}`}>
          {message.replyTo && (
            <div className="message-reply-preview">{message.replyTo.body}</div>
          )}

          {message.body}

          {message.editedAt && <small className="edited-label">edited</small>}

          {message.pending && (
            <small className="pending-label">Sending...</small>
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

      {!isEditing && (
        <div className="message-actions">
          <button
            type="button"
            className="message-action-button"
            aria-label="Reply to message"
            title="Reply to message"
            onClick={() => onReply(message)}
          >
            <Reply fontSize="small" />
          </button>

          <div className="message-reaction-wrapper">
            <button
              type="button"
              className="message-action-button"
              aria-label="React to message"
              title="React to message"
              onClick={() => setShowEmojiPicker((current) => !current)}
            >
              <EmojiEmotions fontSize="small" />
            </button>

            {showEmojiPicker && (
              <div className="message-reaction-picker">
                <EmojiPicker
                  onEmojiClick={(emojiData) => {
                    onReact(message.id, emojiData.emoji);
                    setShowEmojiPicker(false);
                  }}
                  width={280}
                  height={360}
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
            onClick={() => onToggleMenu(message.id)}
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
