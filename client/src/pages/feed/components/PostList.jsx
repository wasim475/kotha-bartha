import { ResourceState } from "../../../utility/helpers";
import PostCard from "./PostCard";

const PostList = ({ posts, onChanged, onOpenPost }) => (
  <ResourceState
    loading={posts.loading}
    error={posts.error}
    empty={
      !posts.data?.length
        ? "No posts yet. Add a friend or share the first post."
        : ""
    }
  >
    {posts.data?.map((post) => (
      <PostCard
        key={post.id}
        post={post}
        onChanged={onChanged}
        onOpenPost={onOpenPost}
      />
    ))}
  </ResourceState>
);

export default PostList;
