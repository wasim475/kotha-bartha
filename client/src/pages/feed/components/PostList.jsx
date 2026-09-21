import { ErrorOutlined, GroupAdd } from "@mui/icons-material";

import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import PostCard from "./PostCard";

function PostCardSkeleton() {
  return (
    <Card
      padded={false}
      className="mb-4 animate-pulse overflow-hidden motion-reduce:animate-none"
    >
      <div className="flex items-center gap-3 p-4">
        <div className="size-10 shrink-0 rounded-full bg-soft" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-32 rounded bg-soft" />
          <div className="h-2.5 w-20 rounded bg-soft" />
        </div>
      </div>
      <div className="space-y-2 px-4 pb-5">
        <div className="h-3 w-full rounded bg-soft" />
        <div className="h-3 w-4/5 rounded bg-soft" />
      </div>
    </Card>
  );
}

function FeedEmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-soft text-muted">
        <GroupAdd fontSize="small" />
      </div>
      <p className="font-display text-lg font-semibold text-ink">
        Your feed is quiet for now
      </p>
      <p className="max-w-xs text-sm text-muted">
        Add a friend or share the first post to see it here.
      </p>
    </div>
  );
}

function FeedErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <ErrorOutlined fontSize="small" />
      </div>
      <p className="text-sm text-muted">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

const PostList = ({ posts, user, onChanged, onPostUpdated, onOpenPost }) => {
  if (posts.loading) {
    return (
      <div aria-busy="true" aria-label="Loading feed">
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    );
  }

  if (posts.error) {
    return <FeedErrorState message={posts.error} onRetry={posts.reload} />;
  }

  if (!posts.data?.length) {
    return <FeedEmptyState />;
  }

  return (
    <div>
      {posts.data.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          user={user}
          onChanged={onChanged}
          onPostUpdated={onPostUpdated}
          onOpenPost={onOpenPost}
        />
      ))}
    </div>
  );
};

export default PostList;
