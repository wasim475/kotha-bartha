import { useLayoutEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import FeedHeader from "./components/FeedHeader";
import NewPostsIndicator from "./components/NewPostsIndicator";
import PostComposer from "./components/PostComposer";
import PostList from "./components/PostList";
import useFeed from "./hooks/useFeed";

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function Feed({ user }) {
  const navigate = useNavigate();
  const {
    posts,
    body,
    setBody,
    busy,
    createPost,
    patchPost,
    pendingCount,
    loadNewPosts,
    scrollSignal,
  } = useFeed();

  const composerRef = useRef(null);
  const feedTopRef = useRef(null);

  // Reveal newly-merged posts by scrolling to the top of the list, without
  // an initial jump on first mount (scrollSignal starts at 0).
  useLayoutEffect(() => {
    if (!scrollSignal) return;
    feedTopRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [scrollSignal]);

  return (
    <>
      <FeedHeader onNewPost={() => composerRef.current?.focus()} />
      <PostComposer
        ref={composerRef}
        user={user}
        body={body}
        setBody={setBody}
        busy={busy}
        onSubmit={createPost}
      />

      <div ref={feedTopRef} />
      <NewPostsIndicator count={pendingCount} onClick={loadNewPosts} />

      <PostList
        posts={posts}
        user={user}
        onChanged={posts.reload}
        onPostUpdated={patchPost}
        onOpenPost={(id) => navigate(`/app/post/${id}`)}
      />
    </>
  );
}
