import { Delete, Edit, EmojiEmotions, MoreVert } from "@mui/icons-material";
import EmojiPicker from "emoji-picker-react";
import { useEffect, useState } from "react";

import { api } from "../../../utility/api";

const CommentSection = ({
  postId,
  postAuthorId,
  showComments,
  setShowComments,
  onChanged,
}) => {
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState("");
  const [reactionOpen, setReactionOpen] = useState(null);

  const loadComments = async () => {
    const { data } = await api.get(`/posts/${postId}/comments`);

    setComments(data.data);
  };

  useEffect(() => {
    if (!showComments) return;

    api.get(`/posts/${postId}/comments`).then(({ data }) => {
      setComments(data.data);
    });
  }, [postId, showComments]);

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
    onChanged();
  };

  const reactToComment = async (commentId, type) => {
    const entry = comments.find((comment) => comment.id === commentId);
    const reaction = entry?.reaction === type ? null : type;
    const { data } = await api.put(`/comments/${commentId}/reaction`, {
      type: reaction,
    });
    setComments((current) =>
      current.map((comment) =>
        comment.id === commentId ? { ...comment, ...data.data } : comment,
      ),
    );
    setReactionOpen(null);
  };

  const addComment = async (event) => {
    event.preventDefault();

    if (!comment.trim()) return;

    await api.post(`/posts/${postId}/comments`, {
      body: comment.trim(),
    });

    setComment("");
    setShowEmojiPicker(false);

    await loadComments();

    setShowComments(true);

    onChanged();
  };

  if (!showComments) return null;

  return (
    <div className="comments">
      {comments.map((entry) => (
        <div className="comment" key={entry.id}>
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
                  onClick={() =>
                    setReactionOpen(reactionOpen === entry.id ? null : entry.id)
                  }
                >
                  Like {entry.reaction ? `(${entry.reaction})` : ""}
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
          </div>
        </div>
      ))}

      <form className="comment-form" onSubmit={addComment}>
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
                previewConfig={{
                  showPreview: false,
                }}
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

        <button className="primary-button small">Comment</button>
      </form>
    </div>
  );
};

export default CommentSection;
