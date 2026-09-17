import {
  ChatBubble,
  ThumbUpAlt,
} from "@mui/icons-material";
import { useState } from "react";

import { api } from "../../../utility/api";
import {
  Avatar,
  formatTime,
} from "../../../utility/helpers";

import CommentSection from "./CommentSection";

export default function PostCard({
  post,
  onChanged,
}) {
  const [showComments, setShowComments] =
    useState(false);

  const toggleLike = async () => {
    await api.put(`/posts/${post.id}/like`, {
      liked: !post.liked,
    });

    onChanged();
  };

  const toggleComments = async () => {
    if (!showComments) {
      setShowComments(true);
    } else {
      setShowComments(false);
    }
  };

  return (
    <article
      className="post-card"
      id={`post-${post.id}`}
    >
      {/* Post Header */}
      <div className="post-header">
        <Avatar person={post.author} />

        <div>
          <strong>{post.author.fullName}</strong>
          <span>
            {formatTime(post.createdAt)}
          </span>
        </div>
      </div>

      {/* Post Body */}
      <p className="post-body">
        {post.body}
      </p>

      {/* Post Stats */}
      <div className="post-stats">
        <span>
          <ThumbUpAlt fontSize="inherit" />{" "}
          {post.likes}
        </span>

        <span>
          {post.comments} comments
        </span>
      </div>

      {/* Post Actions */}
      <div className="post-actions">
        <button
          className={
            post.liked ? "selected" : ""
          }
          onClick={toggleLike}
        >
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
        showComments={showComments}
        setShowComments={setShowComments}
        onChanged={onChanged}
      />
    </article>
  );
}