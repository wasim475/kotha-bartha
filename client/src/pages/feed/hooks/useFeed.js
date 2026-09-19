import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "../../../utility/api";
import { useResource } from "../../../utility/helpers";

const useFeed = () => {
  const posts = useResource("/posts/feed");
  const [searchParams] = useSearchParams();
  const postId = searchParams.get("post");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!postId || posts.loading || !posts.data?.length) return;

    document.getElementById(`post-${postId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [postId, posts.loading, posts.data]);

  const createPost = async () => {
    const text = body.trim();
    if (!text || busy) return;

    setBusy(true);
    try {
      await api.post("/posts", { body: text });
      setBody("");
      posts.reload();
    } catch (error) {
      console.error("Failed to create post:", error);
    } finally {
      setBusy(false);
    }
  };

  return { posts, body, setBody, busy, createPost };
};

export default useFeed;
