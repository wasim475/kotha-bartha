import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "../../../utility/api";
import { useRealtime, useResource } from "../../../utility/helpers";

const useFeed = () => {
  const posts = useResource("/posts/feed");
  const [searchParams] = useSearchParams();
  const postId = searchParams.get("post");
  const [body, setBody] = useState("");
  const [imageFiles, setImageFiles] = useState([]);
  const [busy, setBusy] = useState(false);

  // Ids already counted toward the "new posts" indicator, so a
  // repeated/late `post:new` event (e.g. after a socket reconnect) can
  // never double-count the same post. This is deliberately separate from
  // "what's currently rendered" — `loadNewPosts` below re-derives that
  // from the live list itself, since a post can be counted as pending
  // before it's actually merged into view.
  const countedIdsRef = useRef(new Set());
  const [pendingCount, setPendingCount] = useState(0);
  // Bumped every time new posts are merged in, so the page can scroll to
  // reveal them without the hook needing to know about the DOM.
  const [scrollSignal, setScrollSignal] = useState(0);

  useEffect(() => {
    (posts.data || []).forEach((post) => countedIdsRef.current.add(post.id));
  }, [posts.data]);

  useRealtime("post:new", (event) => {
    const id = event.detail?.postId;
    if (!id || countedIdsRef.current.has(id)) return;
    countedIdsRef.current.add(id);
    setPendingCount((count) => count + 1);
  });

  useEffect(() => {
    if (!postId || posts.loading || !posts.data?.length) return;

    document.getElementById(`post-${postId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [postId, posts.loading, posts.data]);

  const createPost = async () => {
    const text = body.trim();
    if ((!text && !imageFiles.length) || busy) return;

    setBusy(true);
    try {
      let data;
      if (imageFiles.length) {
        const formData = new FormData();
        formData.append("body", text);
        imageFiles.forEach((file) => formData.append("files", file));
        ({ data } = await api.post("/posts", formData));
      } else {
        ({ data } = await api.post("/posts", { body: text }));
      }
      countedIdsRef.current.add(data.data.id);
      posts.setData((current = []) => [data.data, ...current]);
      setBody("");
      setImageFiles([]);
    } catch (error) {
      console.error("Failed to create post:", error);
    } finally {
      setBusy(false);
    }
  };

  const patchPost = (id, patch) => {
    posts.setData((current = []) =>
      current.map((post) => (post.id === id ? { ...post, ...patch } : post)),
    );
  };

  const loadNewPosts = async () => {
    try {
      const { data } = await api.get("/posts/feed");
      const freshPosts = data.data || [];

      posts.setData((current = []) => {
        const renderedIds = new Set(current.map((post) => post.id));
        const newOnes = freshPosts.filter((post) => !renderedIds.has(post.id));
        if (!newOnes.length) return current;

        newOnes.forEach((post) => countedIdsRef.current.add(post.id));
        return [...newOnes, ...current];
      });
    } catch (error) {
      console.error("Failed to load new posts:", error);
    } finally {
      setPendingCount(0);
      setScrollSignal((value) => value + 1);
    }
  };

  return {
    posts,
    body,
    setBody,
    imageFiles,
    setImageFiles,
    busy,
    createPost,
    patchPost,
    pendingCount,
    loadNewPosts,
    scrollSignal,
  };
};

export default useFeed;
