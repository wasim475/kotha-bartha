import { ChatBubbleOutlined, Delete, Edit, MoreHoriz } from "@mui/icons-material";
import { useState } from "react";

import Avatar from "../../../components/ui/Avatar";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import IconButton from "../../../components/ui/IconButton";
import Menu from "../../../components/ui/Menu";
import ReactionButton from "../../../components/ui/reactions/ReactionButton";
import ReactionSummary from "../../../components/ui/reactions/ReactionSummary";
import { REACTION_TYPES } from "../../../components/ui/reactions/reactionTypes";
import { formatTime } from "../../../utility/helpers";
import usePostActions from "../hooks/usePostActions";

import CommentSection from "./CommentSection/CommentSection";

export default function PostCard({
  post,
  user,
  onChanged,
  onPostUpdated,
  onOpenPost = () => {},
  initialShowComments = false,
}) {
  const [showComments, setShowComments] = useState(initialShowComments);
  const { editing, setEditing, body, setBody, savePost, deletePost, reactToPost } =
    usePostActions({ post, onChanged, onPostUpdated });

  const openComments = () => setShowComments(true);
  const toggleComments = () => setShowComments((current) => !current);

  return (
    <Card as="article" id={`post-${post.id}`} padded={false} className="mb-4 overflow-hidden">
      {/* Author */}
      <div className="flex items-center gap-3 p-4">
        <Avatar person={post.author} size="md" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{post.author.fullName}</p>
          <p className="text-xs text-muted">{formatTime(post.createdAt)}</p>
        </div>

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
          className="cursor-pointer px-4 pb-4 text-[15px] leading-relaxed text-ink transition-colors hover:text-accent"
        >
          {post.body}
        </p>
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
        />
      </div>
    </Card>
  );
}
