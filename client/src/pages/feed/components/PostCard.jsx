import { ChatBubbleOutlined, Delete, Edit, MoreHoriz } from "@mui/icons-material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { cx } from "../../../utility/cx";

import Avatar from "../../../components/ui/Avatar";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import IconButton from "../../../components/ui/IconButton";
import Menu from "../../../components/ui/Menu";
import RichText from "../../../components/ui/RichText";
import ReactionButton from "../../../components/ui/reactions/ReactionButton";
import ReactionSummary from "../../../components/ui/reactions/ReactionSummary";
import { REACTION_TYPES } from "../../../components/ui/reactions/reactionTypes";
import { formatTime } from "../../../utility/helpers";
import usePostActions from "../hooks/usePostActions";

import CommentSection from "./CommentSection/CommentSection";
import PostMediaGrid from "./PostMediaGrid";

// Character-count based, not a fixed pixel/line height — a long post gets
// clamped by line count (which scales with font size and column width, so
// it can't overflow on mobile the way a hardcoded max-height would).
const POST_PREVIEW_LIMIT = 320;

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function PostCard({
  post,
  user,
  onChanged,
  onPostUpdated,
  onOpenPost = () => {},
  onOpenImage = null,
  initialShowComments = false,
  truncate = true,
  highlightPost = false,
  targetCommentId = null,
  targetReplyId = null,
}) {
  const [showComments, setShowComments] = useState(initialShowComments);
  const [postHighlighted, setPostHighlighted] = useState(false);
  const { editing, setEditing, body, setBody, savePost, deletePost, reactToPost } =
    usePostActions({ post, onChanged, onPostUpdated });
  const isLong = truncate && post.body.length > POST_PREVIEW_LIMIT;

  const openComments = () => setShowComments(true);
  const toggleComments = () => setShowComments((current) => !current);

  // A post-only notification (no target comment/reply) lands here and the
  // whole card should read as "this is what you clicked" — scroll it into
  // view and flash it briefly, same idea as the comment/reply highlight in
  // CommentSection below.
  useEffect(() => {
    if (!highlightPost) return;
    const node = document.getElementById(`post-${post.id}`);
    node?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPostHighlighted(true);
    const timer = setTimeout(() => setPostHighlighted(false), 2200);
    return () => clearTimeout(timer);
  }, [highlightPost, post.id]);

  return (
    <Card
      as="article"
      id={`post-${post.id}`}
      padded={false}
      className={cx(
        "mb-4 overflow-hidden transition-shadow motion-safe:duration-500",
        postHighlighted && "ring-2 ring-accent ring-offset-2 ring-offset-paper",
      )}
    >
      {/* Author */}
      <div className="flex items-center gap-3 p-4">
        <Link
          to={`/app/profile/${post.author.id}`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Avatar person={post.author} size="md" />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink hover:underline">
              {post.author.fullName}
            </p>
            <p className="text-xs text-muted">{formatTime(post.createdAt)}</p>
          </div>
        </Link>

        {post.editable && (
          <Menu
            align="end"
            trigger={<IconButton label="Post options" icon={<MoreHoriz fontSize="small" />} size="sm" />}
            items={[
              {
                key: "edit",
                label: "Edit",
                icon: <Edit fontSize="small" />,
                onClick: () => setEditing(true),
              },
              {
                key: "delete",
                label: "Delete",
                icon: <Delete fontSize="small" />,
                danger: true,
                onClick: deletePost,
              },
            ]}
          />
        )}
      </div>

      {/* Images */}
      {post.media?.length > 0 && (
        <PostMediaGrid
          media={post.media}
          onOpen={(index) => (onOpenImage ? onOpenImage(index) : onOpenPost(post.id))}
        />
      )}

      {/* Content */}
      {editing ? (
        <form className="grid gap-2 px-4 pb-4" onSubmit={savePost}>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            className="w-full resize-y rounded-md border border-line bg-panel p-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save
            </Button>
          </div>
        </form>
      ) : (
        <div className="px-4 pb-4">
          <p
            onClick={() => onOpenPost(post.id)}
            role="link"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenPost(post.id);
              }
            }}
            className={cx(
              "cursor-pointer text-[15px] leading-relaxed text-ink transition-colors hover:text-accent",
              isLong && "line-clamp-6",
            )}
          >
            <RichText text={post.body} />
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => onOpenPost(post.id)}
              className="mt-1 text-sm font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              See more
            </button>
          )}
        </div>
      )}

      {/* Reaction + comment summary */}
      {(post.likes > 0 || post.comments > 0) && (
        <div className="flex items-center justify-between px-4 pb-2 text-xs">
          <ReactionSummary reactions={post.reactions} />
          {post.comments > 0 && (
            <button
              type="button"
              onClick={openComments}
              className="font-medium text-muted transition-colors hover:text-accent"
            >
              {post.comments} comment{post.comments === 1 ? "" : "s"}
            </button>
          )}
        </div>
      )}

      {/* Primary actions */}
      <div className="grid grid-cols-2 gap-1 border-t border-line p-1">
        <ReactionButton
          value={post.reaction}
          onChange={reactToPost}
          types={REACTION_TYPES}
          label="Like this post"
          fullWidth
        />
        <button
          type="button"
          onClick={toggleComments}
          aria-pressed={showComments}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-semibold text-muted transition-colors motion-safe:duration-150 hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ChatBubbleOutlined fontSize="small" />
          Comment
        </button>
      </div>

      {/* Comments */}
      <div className="px-4">
        <CommentSection
          postId={post.id}
          postAuthorId={post.author.id}
          user={user}
          showComments={showComments}
          setShowComments={setShowComments}
          onChanged={onChanged}
          targetCommentId={targetCommentId}
          targetReplyId={targetReplyId}
        />
      </div>
    </Card>
  );
}
