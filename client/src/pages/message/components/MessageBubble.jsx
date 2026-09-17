import { Delete, Edit, MoreVert } from "@mui/icons-material";

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
}) => {
  return (
    <div
      className={`message-row ${isOwn ? "own" : ""}`}
    >
      {/* Editing */}
      {isEditing ? (
        <div className="message-edit-box">
          <input
            value={editBody}
            onChange={(event) =>
              setEditBody(event.target.value)
            }
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
          className={`message-bubble ${
            isOwn ? "own" : ""
          }`}
        >
          {message.body}

          {message.editedAt && (
            <small className="edited-label">
              edited
            </small>
          )}

          {message.pending && (
            <small className="pending-label">
              Sending...
            </small>
          )}
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
                aria-label={
                  isDeleting
                    ? "Deleting message"
                    : "Delete message"
                }
                title={
                  isDeleting
                    ? "Deleting message"
                    : "Delete message"
                }
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