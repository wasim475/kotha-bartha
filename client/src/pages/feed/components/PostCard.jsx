import { ChatBubble, MoreVert, ThumbUpAlt } from "@mui/icons-material";
import { useState } from "react";

import { Avatar, formatTime } from "../../../utility/helpers";
import usePostActions from "../hooks/usePostActions";

import CommentSection from "./CommentSection/CommentSection";

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
  } = usePostActions({ post, onChanged });

  const toggleComments = async () => {
    if (!showComments) {
      setShowComments(true);
    } else {
      setShowComments(false);
    }
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
        <button className={post.liked ? "selected" : ""} onClick={toggleLike}>
          <ThumbUpAlt fontSize="small" />
          Like
        </button>

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
