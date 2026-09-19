import { useEffect, useState } from "react";

import { api } from "../../../../utility/api";
import CommentForm from "./CommentForm";
import CommentItem from "./CommentItem";
import CommentList from "./CommentList";

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
    api
      .get(`/posts/${postId}/comments`)
      .then(({ data }) => setComments(data.data));
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
    onChanged?.();
  };

  const reactToComment = async (commentId, type) => {
    const entry = comments.find((current) => current.id === commentId);
    const reaction = entry?.reaction === type ? null : type;
    const nextReactions = { ...(entry?.reactions || {}) };
    if (entry?.reaction)
      nextReactions[entry.reaction] = Math.max(
        0,
        (nextReactions[entry.reaction] || 0) - 1,
      );
    if (reaction) nextReactions[reaction] = (nextReactions[reaction] || 0) + 1;

    setComments((current) =>
      current.map((item) =>
        item.id === commentId
          ? { ...item, reaction, reactions: nextReactions }
          : item,
      ),
    );
    try {
      const { data } = await api.put(`/comments/${commentId}/reaction`, {
        type: reaction,
      });
      setComments((current) =>
        current.map((item) =>
          item.id === commentId ? { ...item, ...data.data } : item,
        ),
      );
    } catch (error) {
      setComments((current) =>
        current.map((item) => (item.id === commentId ? entry : item)),
      );
      if (error.response?.status !== 404)
        console.error("Unable to react to comment:", error);
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

  const renderComment = (entry) => {
    const replies = comments.filter((item) => item.parentId === entry.id);
    return {
      entry,
      editing: editingId === entry.id,
      editBody,
      onEditBodyChange: setEditBody,
      onSaveEdit: () => saveComment(entry.id),
      onCancelEdit: () => setEditingId(null),
      reactionOpen: reactionOpen === entry.id,
      onToggleReaction: () =>
        setReactionOpen(reactionOpen === entry.id ? null : entry.id),
      onReact: (type) => reactToComment(entry.id, type),
      onReply: () => {
        setReplyingTo(replyingTo === entry.id ? null : entry.id);
        setReplyBody("");
      },
      replyOpen: replyingTo === entry.id,
      replyBody,
      onReplyBodyChange: setReplyBody,
      onSubmitReply: (event) => addComment(event, entry.id),
      onCancelReply: () => setReplyingTo(null),
      menuOpen: menuOpen === entry.id,
      onToggleMenu: () => setMenuOpen(menuOpen === entry.id ? null : entry.id),
      onEdit: () => {
        setEditingId(entry.id);
        setEditBody(entry.body);
        setMenuOpen(null);
      },
      onDelete: () => deleteComment(entry.id),
      replies,
      renderReply: (reply) => (
        <CommentItem
          key={reply.id}
          {...renderComment(reply)}
          postAuthorId={postAuthorId}
        />
      ),
    };
  };

  if (!showComments) return null;

  return (
    <div className="comments">
      <CommentList
        comments={comments}
        postAuthorId={postAuthorId}
        renderComment={renderComment}
      />
      <CommentForm
        value={comment}
        onChange={setComment}
        onSubmit={(event) => addComment(event)}
        emojiOpen={showEmojiPicker}
        onToggleEmoji={() => setShowEmojiPicker((current) => !current)}
        onEmoji={(emoji) => setComment((current) => `${current}${emoji}`)}
      />
    </div>
  );
};

export default CommentSection;
