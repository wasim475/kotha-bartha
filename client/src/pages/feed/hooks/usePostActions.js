import { useState } from "react";

import { api } from "../../../utility/api";

const usePostActions = ({ post, onChanged }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(post.body);

  const savePost = async (event) => {
    event.preventDefault();
    if (!body.trim()) return;

    await api.patch(`/posts/${post.id}`, { body: body.trim() });
    setEditing(false);
    setMenuOpen(false);
    onChanged();
  };

  const deletePost = async () => {
    if (!window.confirm("Delete this post?")) return;
    await api.delete(`/posts/${post.id}`);
    onChanged();
  };

  const toggleLike = async () => {
    await api.put(`/posts/${post.id}/like`, { liked: !post.liked });
    onChanged();
  };

  return {
    menuOpen,
    setMenuOpen,
    editing,
    setEditing,
    body,
    setBody,
    savePost,
    deletePost,
    toggleLike,
  };
};

export default usePostActions;
