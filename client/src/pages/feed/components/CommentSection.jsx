import { EmojiEmotions } from "@mui/icons-material";
import EmojiPicker from "emoji-picker-react";
import { useState } from "react";

import { api } from "../../../utility/api";

const CommentSection = ({
  postId,
  showComments,
  setShowComments,
  onChanged,
}) => {
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const loadComments = async () => {
    const { data } = await api.get(
      `/posts/${postId}/comments`,
    );

    setComments(data.data);
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
          <div>
            <strong>{entry.author.fullName}</strong>
            <p>{entry.body}</p>
          </div>
        </div>
      ))}

      <form
        className="comment-form"
        onSubmit={addComment}
      >
        <div className="emoji-wrapper">
          <button
            type="button"
            className="emoji-button"
            aria-label="Choose emoji"
            title="Choose emoji"
            onClick={() =>
              setShowEmojiPicker(
                (current) => !current,
              )
            }
          >
            <EmojiEmotions fontSize="small" />
          </button>

          {showEmojiPicker && (
            <div className="emoji-picker">
              <EmojiPicker
                onEmojiClick={(emojiData) =>
                  setComment(
                    (current) =>
                      `${current}${emojiData.emoji}`,
                  )
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
          onChange={(event) =>
            setComment(event.target.value)
          }
          placeholder="Write a comment..."
        />

        <button className="primary-button small">
          Comment
        </button>
      </form>
    </div>
  );
};

export default CommentSection;