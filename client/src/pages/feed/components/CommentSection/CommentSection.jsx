import { useEffect, useRef, useState } from "react";

import { api } from "../../../../utility/api";
import CommentForm from "./CommentForm";
import CommentList from "./CommentList";

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// All descendants of a top-level comment, any depth, flattened into one
// chronological list — the approved "flatten to one visual level" reply
// design. A reply-to-a-reply still carries its real parentId (used to
// show "Replying to @name"), it just doesn't nest visually any deeper.
function collectDescendants(parentId, allComments) {
  const direct = allComments.filter((item) => item.parentId === parentId);
  return direct.flatMap((item) => [item, ...collectDescendants(item.id, allComments)]);
}

// Walks parentId links up to the root so a reply-to-a-reply can still be
// attributed to the top-level comment thread it visually belongs to.
function findTopLevelId(id, allComments) {
  let current = allComments.find((item) => item.id === id);
  while (current?.parentId) {
    current = allComments.find((item) => item.id === current.parentId);
  }
  return current?.id ?? id;
}

const CommentSection = ({
  postId,
  postAuthorId,
  user,
  showComments,
  setShowComments,
  onChanged,
  targetCommentId = null,
  targetReplyId = null,
}) => {
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyBody, setReplyBody] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showReplyEmojiPicker, setShowReplyEmojiPicker] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState("");
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [expandedReplyThreads, setExpandedReplyThreads] = useState(() => new Set());
  const [highlightId, setHighlightId] = useState(null);
  const pendingHighlightRef = useRef(targetReplyId || targetCommentId || null);

  useEffect(() => {
    if (!showComments) return;
    api
      .get(`/posts/${postId}/comments`)
      .then(({ data }) => setComments(data.data));
  }, [postId, showComments]);

  // A deep-linked comment/reply target: reveal whatever collapsed sections
  // are hiding it as soon as the comments load, then (in the effect below)
  // scroll to it and flash a highlight once its DOM node actually exists.
  useEffect(() => {
    const targetId = targetReplyId || targetCommentId;
    if (!targetId || !comments.some((entry) => entry.id === targetId)) return;

    pendingHighlightRef.current = targetId;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCommentsExpanded(true);
    if (targetReplyId) {
      const topLevelId = findTopLevelId(targetReplyId, comments);
      setExpandedReplyThreads((current) => new Set(current).add(topLevelId));
    }
  }, [targetCommentId, targetReplyId, comments]);

  // Runs after every render (no dependency array) so it can keep checking
  // for the target's DOM node — it only exists once the expand states set
  // above have actually propagated into a rendered CommentItem/ReplyItem.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const targetId = pendingHighlightRef.current;
    if (!targetId) return;
    const node = document.getElementById(`comment-${targetId}`);
    if (!node) return;

    pendingHighlightRef.current = null;
    node.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "center",
    });
    setHighlightId(targetId);
    const timer = setTimeout(() => setHighlightId(null), 2200);
    return () => clearTimeout(timer);
  });

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
    const { data } = await api.delete(`/comments/${commentId}`);
    // The server cascades the delete to every reply beneath this comment
    // (any depth) and returns all the ids it actually removed — falls back
    // to just commentId for safety if an older response shape ever shows up.
    const removedIds = new Set(data.data.deletedIds || [commentId]);
    setComments((current) => current.filter((entry) => !removedIds.has(entry.id)));
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
    // Guards against a duplicate comment/reply being created when the
    // submit button is double-clicked (or Enter is pressed while a click is
    // still in flight) — without this, both requests would succeed and the
    // same text would appear twice.
    if (parentId ? submittingReply : submittingComment) return;

    if (parentId) setSubmittingReply(true);
    else setSubmittingComment(true);

    try {
      const { data } = await api.post(`/posts/${postId}/comments`, {
        body: value,
        parentId,
      });
      setComments((current) => [...current, data.data]);
      if (parentId) {
        const topLevelId = findTopLevelId(parentId, comments);
        setExpandedReplyThreads((current) => new Set(current).add(topLevelId));
      } else {
        setCommentsExpanded(true);
      }
      setComment("");
      setReplyBody("");
      setReplyingTo(null);
      setShowEmojiPicker(false);
      setShowReplyEmojiPicker(false);
      setShowComments(true);
      onChanged?.();
    } finally {
      if (parentId) setSubmittingReply(false);
      else setSubmittingComment(false);
    }
  };

  const startReply = (targetId) => {
    setReplyingTo((current) => (current === targetId ? null : targetId));
    setReplyBody("");
    setShowReplyEmojiPicker(false);
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
      highlighted: entry.id === highlightId,
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
            onCancelReply: () => {
              setReplyingTo(null);
              setShowReplyEmojiPicker(false);
            },
            replySubmitting: submittingReply,
            replyEmojiOpen: showReplyEmojiPicker,
            onToggleReplyEmoji: () => setShowReplyEmojiPicker((current) => !current),
            onReplyEmoji: (emoji) => setReplyBody((current) => `${current}${emoji}`),
            replies,
            repliesExpanded: expandedReplyThreads.has(entry.id),
            onExpandReplies: () =>
              setExpandedReplyThreads((current) => new Set(current).add(entry.id)),
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
        submitting={submittingComment}
        emojiOpen={showEmojiPicker}
        onToggleEmoji={() => setShowEmojiPicker((current) => !current)}
        onEmoji={(emoji) => setComment((current) => `${current}${emoji}`)}
      />

      <CommentList
        comments={comments}
        postAuthorId={postAuthorId}
        user={user}
        renderComment={renderComment}
        expanded={commentsExpanded}
        onExpand={() => setCommentsExpanded(true)}
      />
    </div>
  );
};

export default CommentSection;
