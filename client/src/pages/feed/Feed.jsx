import { Add, Send } from "@mui/icons-material";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { api } from "../../utility/api";
import { ResourceState, useResource } from "../../utility/helpers";

import PostCard from "./components/PostCard";

export default function Feed({ user }) {
  const navigate = useNavigate();
  const posts = useResource("/posts/feed");

  const [searchParams] = useSearchParams();
  const postId = searchParams.get("post");

  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!postId || posts.loading || !posts.data?.length) {
      return;
    }

    const postElement = document.getElementById(`post-${postId}`);

    if (postElement) {
      postElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [postId, posts.loading, posts.data]);

  const createPost = async () => {
    const text = body.trim();

    if (!text || busy) return;

    setBusy(true);

    try {
      await api.post("/posts", {
        body: text,
      });

      setBody("");

      posts.reload();
    } catch (error) {
      console.error("Failed to create post:", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <span className="eyebrow">Your people</span>
          <h1>Your feed</h1>
        </div>

        <button
          type="button"
          className="primary-button small"
          onClick={createPost}
          disabled={busy}
        >
          <Add fontSize="small" />
          Create post
        </button>
      </div>

      {/* Create Post */}
      <section className="composer">
        <div className="avatar avatar-coral">
          {user.fullName.slice(0, 2).toUpperCase()}
        </div>

        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={`What is on your mind, ${user.fullName.split(" ")[0]}?`}
          rows="2"
        />

        <div className="composer-actions">
          <button type="button" disabled={busy} onClick={createPost}>
            <Send />

            {busy ? "Posting..." : "Post"}
          </button>
        </div>
      </section>

      {/* Feed */}
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
            onChanged={posts.reload}
            onOpenPost={(id) => navigate(`/app/post/${id}`)}
          />
        ))}
      </ResourceState>
    </>
  );
}
