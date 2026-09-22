import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../../../utility/api";
import { useResource } from "../../../utility/helpers";

/**
 * Everything about the profile *page itself* (not its posts/photos, see
 * useProfilePosts): the person's data, friend/message/block actions, and
 * (own profile only) editing basic info + avatar/cover.
 */
const useProfile = (profileId, viewer) => {
  const navigate = useNavigate();
  const profile = useResource(`/users/${profileId}`);
  const own = profileId === viewer.id;

  const [busy, setBusy] = useState(null); // "friend" | "cancel" | "message" | "block" | "unblock" | null
  const [confirmAction, setConfirmAction] = useState(null); // "unfriend" | "block" | null
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const runAction = async (key, task) => {
    if (busy) return;
    setBusy(key);
    try {
      await task();
      await profile.reload();
    } catch (error) {
      console.error(error.response?.data?.error?.message || "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  const startMessage = () =>
    runAction("message", async () => {
      const { data } = await api.post("/conversations", { userId: profileId });
      navigate(`/app/messages/${data.data.id}`);
    });

  const addFriend = () =>
    runAction("friend", () => api.post("/friends/requests", { receiverId: profileId }));

  const acceptRequest = () =>
    runAction("friend", () =>
      api.post(`/friends/requests/${profile.data.receivedFriendRequestId}/accept`),
    );

  const cancelRequest = () =>
    runAction("cancel", () => api.delete(`/friends/requests/${profileId}`));

  const unfriend = () =>
    runAction("unfriend", () => api.delete(`/friends/${profileId}`)).then(() =>
      setConfirmAction(null),
    );

  const blockUser = () =>
    runAction("block", () => api.post(`/blocks/${profileId}`)).then(() =>
      setConfirmAction(null),
    );

  const unblockUser = () => runAction("unblock", () => api.delete(`/blocks/${profileId}`));

  const saveAbout = async (fields) => {
    const { data } = await api.patch("/users/me", fields);
    profile.setData((current) => ({ ...current, ...data.data }));
  };

  const uploadImage = async (field, file) => {
    if (!file) return;
    const setUploading = field === "avatar" ? setAvatarUploading : setCoverUploading;
    setUploading(true);
    setUploadError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const { data } = await api.patch(`/users/me/${field}`, formData);
      profile.setData((current) => ({ ...current, [field]: data.data[field] }));
    } catch (error) {
      setUploadError(
        error.response?.data?.error?.message ||
          `Couldn't update your ${field === "avatar" ? "profile photo" : "cover photo"}.`,
      );
    } finally {
      setUploading(false);
    }
  };

  return {
    profile,
    own,
    busy,
    confirmAction,
    setConfirmAction,
    startMessage,
    addFriend,
    acceptRequest,
    cancelRequest,
    unfriend,
    blockUser,
    unblockUser,
    saveAbout,
    uploadImage,
    avatarUploading,
    coverUploading,
    uploadError,
  };
};

export default useProfile;
