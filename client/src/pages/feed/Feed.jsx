import { useNavigate } from "react-router-dom";

import FeedHeader from "./components/FeedHeader";
import PostComposer from "./components/PostComposer";
import PostList from "./components/PostList";
import useFeed from "./hooks/useFeed";

export default function Feed({ user }) {
  const navigate = useNavigate();
  const { posts, body, setBody, busy, createPost } = useFeed();

  return (
    <>
      <FeedHeader onCreatePost={createPost} busy={busy} />
      <PostComposer
        user={user}
        body={body}
        setBody={setBody}
        busy={busy}
        onSubmit={createPost}
      />
      <PostList
        posts={posts}
        onChanged={posts.reload}
        onOpenPost={(id) => navigate(`/app/post/${id}`)}
      />
    </>
  );
}
