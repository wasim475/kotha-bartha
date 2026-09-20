import { ChatBubble, Delete, Edit, MoreVert, ThumbUpAlt } from "@mui/icons-material";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Avatar, formatTime } from "../../../utility/helpers";
import usePostActions from "../hooks/usePostActions";

import CommentSection from "./CommentSection/CommentSection";

const POST_REACTIONS = [
  { type: "like", emoji: "👍", label: "Like" },
  { type: "haha", emoji: "😂", label: "Haha" },
  { type: "care", emoji: "❤️", label: "Care" },
  { type: "angry", emoji: "😡", label: "Angry" },
];

// The hover picker is a desktop-only affordance (hover + fine pointer support).
const CAN_HOVER =
  typeof window !== "undefined" &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

export default function PostCard({
  post,
  onChanged,
  onOpenPost = () => {},
  initialShowComments = false,
}) {
  const [showComments, setShowComments] = useState(initialShowComments);
  const {
    menuOpen,
    setMenuOpen,
    editing,
    setEditing,
    body,
    setBody,
    savePost,
    deletePost,
    toggleLike,
    reactToPost,
  } = usePostActions({ post, onChanged });

  const toggleComments = async () => {
    if (!showComments) {
      setShowComments(true);
    } else {
      setShowComments(false);
    }
  };

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerOffset, setPickerOffset] = useState(0);
  const likeWrapRef = useRef(null);
  const pickerRef = useRef(null);
  const closeTimer = useRef(null);

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const openPicker = () => {
    if (!CAN_HOVER) return;
    clearCloseTimer();
    setPickerOpen(true);
  };

  const schedulePickerClose = () => {
    if (!CAN_HOVER) return;
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setPickerOpen(false), 200);
  };

  // Close when clicking outside the Like button / picker, or pressing Escape.
  useEffect(() => {
    if (!pickerOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!event.target.closest?.(".post-like-wrap")) {
        setPickerOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setPickerOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [pickerOpen]);

  // Keep the picker inside the viewport by clamping its horizontal offset.
  useLayoutEffect(() => {
    if (!pickerOpen) return;

    const wrap = likeWrapRef.current;
    const picker = pickerRef.current;
    if (!wrap || !picker) return;

    const wrapRect = wrap.getBoundingClientRect();
    const pickerWidth = picker.offsetWidth;
    const margin = 8;

    const centeredOffset = wrapRect.width / 2 - pickerWidth / 2;
    const minOffset = margin - wrapRect.left;
    const maxOffset = window.innerWidth - margin - pickerWidth - wrapRect.left;

    setPickerOffset(
      Math.min(Math.max(centeredOffset, minOffset), Math.max(minOffset, maxOffset)),
    );
  }, [pickerOpen]);

  useEffect(() => clearCloseTimer, []);

  const handlePickReaction = (type) => {
    setPickerOpen(false);
    reactToPost(type);
  };

  return (
    <article className="post-card" id={`post-${post.id}`}>
      {/* Post Header */}
      <div className="post-header">
        <Avatar person={post.author} />

        <div>
          <strong>{post.author.fullName}</strong>
          <span>{formatTime(post.createdAt)}</span>
        </div>

        {post.editable && (
          <div className="feed-menu">
            <button
              type="button"
              className="feed-menu-button"
              aria-label="Post options"
              title="Post options"
              onClick={() => setMenuOpen((current) => !current)}
            >
              <MoreVert fontSize="small" />
            </button>

            {menuOpen && (
              <div className="feed-menu-popover">
                <button type="button" onClick={() => setEditing(true)}>
                  <Edit fontSize="small" /> Edit
                </button>
                <button type="button" onClick={deletePost}>
                  <Delete fontSize="small" /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <form className="feed-edit-form" onSubmit={savePost}>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <div>
            <button type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="submit" className="primary-button small">
              Save
            </button>
          </div>
        </form>
      ) : (
        <p
          className="post-body post-body-link"
          onClick={() => onOpenPost(post.id)}
          role="link"
          tabIndex="0"
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpenPost(post.id);
            }
          }}
        >
          {post.body}
        </p>
      )}

      {/* Post Stats */}
      <div className="post-stats">
        <span>
          <ThumbUpAlt fontSize="inherit" /> {post.likes}
        </span>

        <span>{post.comments} comments</span>
      </div>

      {/* Post Actions */}
      <div className="post-actions">
        <div
          className="post-like-wrap"
          ref={likeWrapRef}
          onMouseEnter={openPicker}
          onMouseLeave={schedulePickerClose}
        >
          <button className={post.liked ? "selected" : ""} onClick={toggleLike}>
            <ThumbUpAlt fontSize="small" />
            Like
          </button>

          <AnimatePresence>
            {pickerOpen && (
              <div
                key="post-reaction-picker"
                className="post-reaction-anchor"
                style={{ transform: `translateX(${pickerOffset}px)` }}
              >
                <Motion.div
                  ref={pickerRef}
                  className="post-reaction-picker"
                  role="menu"
                  aria-label="Pick a reaction"
                  initial={{ opacity: 0, scale: 0.8, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 6 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  {POST_REACTIONS.map((reaction) => (
                    <button
                      key={reaction.type}
                      type="button"
                      role="menuitem"
                      className={post.reaction === reaction.type ? "active" : ""}
                      title={reaction.label}
                      aria-label={`React with ${reaction.label}`}
                      onClick={() => handlePickReaction(reaction.type)}
                    >
                      <span aria-hidden="true">{reaction.emoji}</span>
                    </button>
                  ))}
                </Motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>

        <button onClick={toggleComments}>
          <ChatBubble fontSize="small" />
          Comment
        </button>
      </div>

      {/* Comment Section */}
      <CommentSection
        postId={post.id}
        postAuthorId={post.author.id}
        showComments={showComments}
        setShowComments={setShowComments}
        onChanged={onChanged}
      />
    </article>
  );
}
