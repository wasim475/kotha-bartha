import {
  Delete,
  Edit,
  EmojiEmotions,
  MoreVert,
  Reply,
} from "@mui/icons-material";
import EmojiPicker from "emoji-picker-react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const emojiPickerWidth = 280;
const emojiPickerHeight = 360;
const viewportGap = 8;

const formatMessageTime = (date) => {
  if (!date) return "";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "";

  return parsedDate.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
};

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
  const messageMenuRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState(null);
  const [isMessageHovered, setIsMessageHovered] = useState(false);

  useEffect(() => {
    if (openMenu !== message.id) return undefined;

    const handleOutsideClick = (event) => {
      if (!messageMenuRef.current?.contains(event.target)) {
        onCloseInteraction();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [message.id, onCloseInteraction, openMenu]);

  useLayoutEffect(() => {
    if (!emojiOpen || !emojiButtonRef.current) {
      setEmojiPickerPosition(null);
      return undefined;
    }

    const positionEmojiPicker = () => {
      const buttonRect = emojiButtonRef.current?.getBoundingClientRect();
      if (!buttonRect) return;

      const pickerWidth = Math.min(
        emojiPickerWidth,
        window.innerWidth - viewportGap * 2,
      );
      const pickerHeight = Math.min(
        emojiPickerHeight,
        window.innerHeight - viewportGap * 2,
      );

      const leftSpace = buttonRect.left - viewportGap;
      const rightSpace = window.innerWidth - buttonRect.right - viewportGap;
      const topSpace = buttonRect.top - viewportGap;
      const bottomSpace = window.innerHeight - buttonRect.bottom - viewportGap;

      const left =
        rightSpace >= pickerWidth || rightSpace >= leftSpace
          ? buttonRect.left
          : buttonRect.right - pickerWidth;
      const top =
        bottomSpace >= pickerHeight || bottomSpace >= topSpace
          ? buttonRect.bottom + viewportGap
          : buttonRect.top - pickerHeight - viewportGap;

      setEmojiPickerPosition({
        left: Math.max(
          viewportGap,
          Math.min(left, window.innerWidth - pickerWidth - viewportGap),
        ),
        top: Math.max(
          viewportGap,
          Math.min(top, window.innerHeight - pickerHeight - viewportGap),
        ),
        width: pickerWidth,
        height: pickerHeight,
      });
    };

    positionEmojiPicker();
    window.addEventListener("resize", positionEmojiPicker);
    window.addEventListener("scroll", positionEmojiPicker, true);

    return () => {
      window.removeEventListener("resize", positionEmojiPicker);
      window.removeEventListener("scroll", positionEmojiPicker, true);
    };
  }, [emojiOpen]);

  useEffect(() => {
    if (!emojiOpen) return undefined;

    const handleOutsideEmojiClick = (event) => {
      if (
        !emojiButtonRef.current?.contains(event.target) &&
        !emojiPickerRef.current?.contains(event.target)
      ) {
        onCloseInteraction();
      }
    };

    document.addEventListener("mousedown", handleOutsideEmojiClick);
    return () =>
      document.removeEventListener("mousedown", handleOutsideEmojiClick);
  }, [emojiOpen, onCloseInteraction]);

  return (
    <div
      className={`message-row ${isOwn ? "own" : ""}`}
      onMouseEnter={() => setIsMessageHovered(true)}
      onMouseLeave={() => setIsMessageHovered(false)}
      onFocus={() => setIsMessageHovered(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsMessageHovered(false);
        }
      }}
    >
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

          <span className="message-meta">
            {message.editedAt && <small className="edited-label">edited</small>}

            {message.pending && (
              <small className="pending-label">Sending...</small>
            )}

            <small className="message-time">
              {formatMessageTime(message.createdAt)}
            </small>

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
          </span>

          {message.reactions?.length > 0 && (
            <div className="message-reactions">
              {message.reactions.map((reaction) => (
                <span key={`${reaction.userId}-${reaction.emoji}`}>
                  {reaction.emoji}
                </span>
              ))}
            </div>
          )}

          {isOwn && (
            <AnimatePresence>
              {isMessageHovered && (
                <Motion.div
                  className="desktop-message-actions"
                  initial={{ opacity: 0, scale: 0.94, x: 8 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.94, x: 8 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    className="desktop-message-action edit-item"
                    aria-label="Edit message"
                    title="Edit message"
                    onClick={() => {
                      onCloseInteraction();
                      onEdit(message);
                    }}
                  >
                    <Edit fontSize="small" />
                  </button>
                  <button
                    type="button"
                    className="desktop-message-action delete-item"
                    aria-label={
                      isDeleting ? "Deleting message" : "Delete message"
                    }
                    title={isDeleting ? "Deleting message" : "Delete message"}
                    onClick={() => {
                      onCloseInteraction();
                      onDelete(message.id);
                    }}
                    disabled={isDeleting}
                  >
                    <Delete fontSize="small" />
                  </button>
                </Motion.div>
              )}
            </AnimatePresence>
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
              ref={emojiButtonRef}
              onClick={onOpenEmoji}
            >
              <EmojiEmotions fontSize="small" /> Emoji
            </button>
          </div>
        </div>
      )}

      {!isEditing && !selected && (
        <AnimatePresence>
          {isMessageHovered && (
            <Motion.div
              className="message-interaction desktop-hover-interaction"
              initial={{ opacity: 0, scale: 0.96, x: 6 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.96, x: 6 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
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
                  ref={emojiButtonRef}
                  onClick={onOpenEmoji}
                >
                  <EmojiEmotions fontSize="small" /> Emoji
                </button>
              </div>
            </Motion.div>
          )}
        </AnimatePresence>
      )}

      {emojiOpen &&
        emojiPickerPosition &&
        createPortal(
          <div
            ref={emojiPickerRef}
            className="message-reaction-picker"
            style={emojiPickerPosition}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <EmojiPicker
              onEmojiClick={(emojiData) => {
                onCloseInteraction();
                onReact(message.id, emojiData.emoji);
              }}
              width={emojiPickerPosition.width}
              height={emojiPickerHeight}
              searchDisabled
              previewConfig={{ showPreview: false }}
              lazyLoadEmojis
            />
          </div>,
          document.body,
        )}

      {/* Message Menu */}
      {isOwn && (
        <div className="message-menu-wrapper" ref={messageMenuRef}>
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
                onClick={() => {
                  onCloseInteraction();
                  onEdit(message);
                }}
              >
                <Edit fontSize="small" />
              </button>

              <button
                type="button"
                className="message-menu-item delete-item"
                aria-label={isDeleting ? "Deleting message" : "Delete message"}
                title={isDeleting ? "Deleting message" : "Delete message"}
                onClick={() => {
                  onCloseInteraction();
                  onDelete(message.id);
                }}
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
