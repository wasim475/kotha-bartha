import {
  Delete,
  Edit,
  EmojiEmotions,
  MoreVert,
  ThumbUpAlt,
} from "@mui/icons-material";
import EmojiPicker from "emoji-picker-react";
import { useEffect, useState } from "react";

import { api } from "../../../utility/api";
import { Avatar } from "../../../utility/helpers";

function SadReactionIcon() {
  return (
    <svg className="reaction-face" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#f7c948" />
      <circle cx="8.5" cy="9.5" r="1" fill="#5b4636" />
      <circle cx="15.5" cy="9.5" r="1" fill="#5b4636" />
      <path
        d="M8 17c1.2-1.8 2.5-2.6 4-2.6s2.8.8 4 2.6"
        fill="none"
        stroke="#5b4636"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AngryReactionIcon() {
  return (
    <svg className="reaction-face" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#f7c948" />
      <path
        d="m7.2 8.7 3 1M16.8 8.7l-3 1"
        stroke="#8b2f2f"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="8.5" cy="11" r="1" fill="#5b4636" />
      <circle cx="15.5" cy="11" r="1" fill="#5b4636" />
      <path
        d="M8 17c1.4-1 2.7-1.4 4-1.4s2.6.4 4 1.4"
        fill="none"
        stroke="#5b4636"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const reactionIcons = {
  like: ThumbUpAlt,
  haha: "😂",
  sad: SadReactionIcon,
  angry: AngryReactionIcon,
};

const CommentSection = ({
  postId,
  postAuthorId,
  showComments,
  setShowComments,
  onChanged,
}) => {
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyBody, setReplyBody] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState("");
  const [reactionOpen, setReactionOpen] = useState(null);

  useEffect(() => {
    if (!showComments) return;
    api.get(`/posts/${postId}/comments`).then(({ data }) => {
      setComments(data.data);
    });
  }, [postId, showComments]);

  const renderReactionIcon = (type) => {
    const ReactionIcon = reactionIcons[type];
    if (typeof ReactionIcon === "string") {
      return <span className="reaction-emoji">{ReactionIcon}</span>;
    }
    return ReactionIcon ? <ReactionIcon fontSize="small" /> : null;
  };

  const saveComment = async (commentId) => {
    if (!editBody.trim()) return;
    const { data } = await api.patch(`/comments/${commentId}`, {
      body: editBody.trim(),
    });
    setComments((current) =>
      current.map((entry) => (entry.id === commentId ? data.data : entry)),
    );
    setEditingId(null);
  };

  const deleteComment = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;
    await api.delete(`/comments/${commentId}`);
    setComments((current) => current.filter((entry) => entry.id !== commentId));
    onChanged?.();
  };

  const reactToComment = async (commentId, type) => {
    const entry = comments.find((current) => current.id === commentId);
    const reaction = entry?.reaction === type ? null : type;
    const nextReactions = { ...(entry?.reactions || {}) };

    if (entry?.reaction) {
      nextReactions[entry.reaction] = Math.max(
        0,
        (nextReactions[entry.reaction] || 0) - 1,
      );
    }
    if (reaction) {
      nextReactions[reaction] = (nextReactions[reaction] || 0) + 1;
    }

    setComments((current) =>
      current.map((commentEntry) =>
        commentEntry.id === commentId
          ? { ...commentEntry, reaction, reactions: nextReactions }
          : commentEntry,
      ),
    );

    try {
      const { data } = await api.put(`/comments/${commentId}/reaction`, {
        type: reaction,
      });
      setComments((current) =>
        current.map((commentEntry) =>
          commentEntry.id === commentId
            ? { ...commentEntry, ...data.data }
            : commentEntry,
        ),
      );
    } catch (error) {
      setComments((current) =>
        current.map((commentEntry) =>
          commentEntry.id === commentId ? entry : commentEntry,
        ),
      );
      if (error.response?.status !== 404) {
        console.error("Unable to react to comment:", error);
      }
    } finally {
      setReactionOpen(null);
    }
  };

  const addComment = async (event, parentId = null) => {
    event.preventDefault();
    const value = parentId ? replyBody.trim() : comment.trim();
    if (!value) return;

    const { data } = await api.post(`/posts/${postId}/comments`, {
      body: value,
      parentId,
    });

    setComments((current) => [...current, data.data]);
    setComment("");
    setReplyBody("");
    setReplyingTo(null);
    setShowEmojiPicker(false);
    setShowComments(true);
    onChanged?.();
  };

  const renderComment = (entry, depth = 0) => {
    const replies = comments.filter(
      (commentEntry) => commentEntry.parentId === entry.id,
    );
    const totalReactions = Object.values(entry.reactions || {}).reduce(
      (total, count) => total + count,
      0,
    );

    return (
      <div
        className={`comment comment-depth-${Math.min(depth, 3)}`}
        key={entry.id}
      >
        <Avatar person={entry.author} />
        <div
          className={
            entry.author.id === postAuthorId ? "comment-post-author" : ""
          }
        >
          <strong>{entry.author.fullName}</strong>
          {editingId === entry.id ? (
            <div className="comment-edit-box">
              <input
                value={editBody}
                onChange={(event) => setEditBody(event.target.value)}
              />
              <button type="button" onClick={() => saveComment(entry.id)}>
                Save
              </button>
              <button type="button" onClick={() => setEditingId(null)}>
                Cancel
              </button>
            </div>
          ) : (
            <p>{entry.body}</p>
          )}

          <div className="comment-actions">
            <div className="reaction-menu">
              <button
                type="button"
                className="reaction-trigger"
                aria-label="React to comment"
                title="React to comment"
                onClick={() =>
                  setReactionOpen(reactionOpen === entry.id ? null : entry.id)
                }
              >
                {entry.reaction ? (
                  renderReactionIcon(entry.reaction)
                ) : (
                  <ThumbUpAlt fontSize="small" />
                )}
              </button>
              {reactionOpen === entry.id && (
                <div className="reaction-popover">
                  {["like", "haha", "sad", "angry"].map((type) => (
                    <button
                      type="button"
                      key={type}
                      onClick={() => reactToComment(entry.id, type)}
                    >
                      {type[0].toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="comment-reactions" aria-label="Comment reactions">
              {Object.entries(entry.reactions || {})
                .filter(([, count]) => count > 0)
                .map(([type]) => (
                  <span className={`comment-reaction ${type}`} key={type}>
                    {renderReactionIcon(type)}
                  </span>
                ))}
              {totalReactions > 0 && (
                <b className="comment-reaction-total">{totalReactions}</b>
              )}
            </div>

            <button
              type="button"
              className="comment-reply-button"
              onClick={() => {
                setReplyingTo(replyingTo === entry.id ? null : entry.id);
                setReplyBody("");
              }}
            >
              Reply
            </button>

            {entry.editable && (
              <div className="feed-menu">
                <button
                  type="button"
                  className="feed-menu-button"
                  aria-label="Comment options"
                  onClick={() =>
                    setMenuOpen(menuOpen === entry.id ? null : entry.id)
                  }
                >
                  <MoreVert fontSize="small" />
                </button>
                {menuOpen === entry.id && (
                  <div className="feed-menu-popover">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(entry.id);
                        setEditBody(entry.body);
                        setMenuOpen(null);
                      }}
                    >
                      <Edit fontSize="small" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteComment(entry.id)}
                    >
                      <Delete fontSize="small" /> Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {replyingTo === entry.id && (
            <form
              className="comment-reply-form"
              onSubmit={(event) => addComment(event, entry.id)}
            >
              <span>Replying to {entry.author.fullName}</span>
              <div>
                <input
                  value={replyBody}
                  onChange={(event) => setReplyBody(event.target.value)}
                  placeholder="Write a reply..."
                  autoFocus
                />
                <button type="button" onClick={() => setReplyingTo(null)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button small">
                  Reply
                </button>
              </div>
            </form>
          )}
        </div>
        {replies.length > 0 && (
          <div className="comment-replies">
            {replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!showComments) return null;

  return (
    <div className="comments">
      {comments
        .filter((entry) => !entry.parentId)
        .map((entry) => renderComment(entry))}
      <form className="comment-form" onSubmit={(event) => addComment(event)}>
        <div className="emoji-wrapper">
          <button
            type="button"
            className="emoji-button"
            aria-label="Choose emoji"
            title="Choose emoji"
            onClick={() => setShowEmojiPicker((current) => !current)}
          >
            <EmojiEmotions fontSize="small" />
          </button>
          {showEmojiPicker && (
            <div className="emoji-picker">
              <EmojiPicker
                onEmojiClick={(emojiData) =>
                  setComment((current) => `${current}${emojiData.emoji}`)
                }
                width={320}
                height={400}
                previewConfig={{ showPreview: false }}
                lazyLoadEmojis
              />
            </div>
          )}
        </div>
        <input
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Write a comment..."
        />
        <button type="submit" className="primary-button small">
          Comment
        </button>
      </form>
    </div>
  );
};

export default CommentSection;
