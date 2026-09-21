import { useState } from "react";

import { api } from "../../../utility/api";

const usePostActions = ({ post, onChanged, onPostUpdated }) => {
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

  // The reaction endpoint returns the authoritative { reaction, reactions,
  // likes, liked } snapshot, so the card can be patched in place instead
  // of forcing a full feed reload for every reaction — same instant-feel
  // pattern as the Phase 2 like button, now covering all 5 reaction types.
  // Selecting the currently-active reaction again removes it, matching
  // the existing comment-reaction contract.
  const reactToPost = async (type) => {
    const nextType = post.reaction === type ? null : type;

    try {
      const { data } = await api.put(`/posts/${post.id}/reaction`, {
        type: nextType,
      });
      if (onPostUpdated) {
        onPostUpdated(post.id, {
          reaction: data.data.reaction,
          reactions: data.data.reactions,
          likes: data.data.likes,
          liked: data.data.liked,
        });
      } else {
        onChanged();
      }
    } catch (error) {
      console.error("Failed to update reaction:", error);
    }
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
    reactToPost,
  };
};

export default usePostActions;
