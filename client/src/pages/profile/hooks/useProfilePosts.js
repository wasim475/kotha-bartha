import { useState } from "react";

import { api } from "../../../utility/api";
import { useResource } from "../../../utility/helpers";

/**
 * Posts + photos for a profile. Creating a post here is exactly the same
 * POST /posts the Feed composer uses — a "profile post" is just a normal
 * post, so this only adds it to *this* list locally after the fact.
 */
const useProfilePosts = (profileId) => {
  const posts = useResource(`/users/${profileId}/posts`);
  const photos = useResource(`/users/${profileId}/photos`);
  const [body, setBody] = useState("");
  const [imageFiles, setImageFiles] = useState([]);
  const [busy, setBusy] = useState(false);

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
      posts.setData((current = []) => [data.data, ...current]);
      if (imageFiles.length) photos.reload();
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

  return { posts, photos, body, setBody, imageFiles, setImageFiles, busy, createPost, patchPost };
};

export default useProfilePosts;
