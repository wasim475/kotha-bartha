import { useEffect, useState } from "react";

import { api } from "../../../../utility/api";
import CommentForm from "./CommentForm";
import CommentList from "./CommentList";

// All descendants of a top-level comment, any depth, flattened into one
// chronological list — the approved "flatten to one visual level" reply
// design. A reply-to-a-reply still carries its real parentId (used to
// show "Replying to @name"), it just doesn't nest visually any deeper.
function collectDescendants(parentId, allComments) {
  const direct = allComments.filter((item) => item.parentId === parentId);
  return direct.flatMap((item) => [item, ...collectDescendants(item.id, allComments)]);
}

const CommentSection = ({
  postId,
  postAuthorId,
  user,
  showComments,
  setShowComments,
  onChanged,
}) => {
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyBody, setReplyBody] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState("");

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

  const startReply = (targetId) => {
    setReplyingTo((current) => (current === targetId ? null : targetId));
    setReplyBody("");
  };

  // Builds every prop a <CommentItem>/<ReplyItem> needs. Called once per
  // top-level comment (for CommentItem) and once per flattened reply (via
  // renderReply, invoked from RepliesList) — same shape either way, so
  // both components share identical edit/react/reply wiring.
  const buildEntryProps = (entry, { topLevelId, replies = [] } = {}) => {
    const isTopLevel = entry.id === (topLevelId ?? entry.id);
    const threadReplyTargetIds = isTopLevel
      ? [entry.id, ...replies.map((reply) => reply.id)]
      : [];

    return {
      entry,
      editing: editingId === entry.id,
      editBody,
      onEditBodyChange: setEditBody,
      onSaveEdit: () => saveComment(entry.id),
      onCancelEdit: () => setEditingId(null),
      onReact: (type) => reactToComment(entry.id, type),
      onReply: () => startReply(entry.id),
      onEdit: () => {
        setEditingId(entry.id);
        setEditBody(entry.body);
      },
      onDelete: () => deleteComment(entry.id),
      ...(isTopLevel
        ? {
            replyOpen: threadReplyTargetIds.includes(replyingTo),
            replyTargetName:
              replyingTo === entry.id
                ? entry.author.fullName
                : replies.find((reply) => reply.id === replyingTo)?.author.fullName,
            replyBody,
            onReplyBodyChange: setReplyBody,
            onSubmitReply: (event) => addComment(event, replyingTo),
            onCancelReply: () => setReplyingTo(null),
            replies,
            renderReply: (reply) => ({
              ...buildEntryProps(reply, { topLevelId: entry.id }),
              replyingToName:
                reply.parentId === entry.id
                  ? null
                  : comments.find((item) => item.id === reply.parentId)?.author.fullName,
            }),
          }
        : {}),
    };
  };

  const renderComment = (entry) => {
    const replies = collectDescendants(entry.id, comments).sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    );
    return buildEntryProps(entry, { topLevelId: entry.id, replies });
  };

  if (!showComments) return null;

  return (
    <div className="mt-3 flex flex-col gap-4 border-t border-line pt-3">
      <CommentForm
        user={user}
        value={comment}
        onChange={setComment}
        onSubmit={(event) => addComment(event)}
        emojiOpen={showEmojiPicker}
        onToggleEmoji={() => setShowEmojiPicker((current) => !current)}
        onEmoji={(emoji) => setComment((current) => `${current}${emoji}`)}
      />

      <CommentList
        comments={comments}
        postAuthorId={postAuthorId}
        user={user}
        renderComment={renderComment}
      />
    </div>
  );
};

export default CommentSection;
