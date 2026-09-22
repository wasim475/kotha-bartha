import { ErrorOutlined, Lock } from "@mui/icons-material";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ConfirmDialog from "../../components/ui/ConfirmDialog";
import PostComposer from "../feed/components/PostComposer";
import PostList from "../feed/components/PostList";
import FriendsTabs from "../friends/components/FriendsTabs";
import AboutSection from "./components/AboutSection";
import PhotosGrid from "./components/PhotosGrid";
import ProfileHeader from "./components/ProfileHeader";
import useProfile from "./hooks/useProfile";
import useProfilePosts from "./hooks/useProfilePosts";

const TABS = [
  { id: "all", label: "All" },
  { id: "about", label: "About" },
  { id: "posts", label: "Posts" },
  { id: "photos", label: "Photos" },
];

function ProfileNotFound({ message }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <ErrorOutlined fontSize="small" />
      </div>
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}

function RestrictedPosts({ label }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-soft text-muted">
        <Lock fontSize="small" />
      </div>
      <p className="text-sm text-muted">Add them as a friend to see their {label}.</p>
    </div>
  );
}

export default function Profile({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const profileId = id === "me" ? user.id : id;
  const [tab, setTab] = useState("all");
  const [editingAbout, setEditingAbout] = useState(false);

  const {
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
  } = useProfile(profileId, user);

  const {
    posts,
    photos,
    body,
    setBody,
    imageFiles,
    setImageFiles,
    busy: postBusy,
    createPost,
    patchPost,
  } = useProfilePosts(profileId);

  const person = profile.data;

  if (profile.error) return <ProfileNotFound message={profile.error} />;

  const postsRestricted = posts.meta?.restricted && !own;

  return (
    <div className="mx-auto max-w-3xl pb-10">
      <ProfileHeader
        person={person}
        loading={profile.loading}
        own={own}
        busy={busy}
        friendRequestReceived={person?.friendRequestReceived}
        onAcceptRequest={acceptRequest}
        onAddFriend={addFriend}
        onCancelRequest={cancelRequest}
        onMessage={startMessage}
        onEditProfile={() => {
          setTab("about");
          setEditingAbout(true);
        }}
        onRequestUnfriend={() => setConfirmAction("unfriend")}
        onRequestBlock={() => setConfirmAction("block")}
        onUnblock={unblockUser}
        onUploadAvatar={(file) => uploadImage("avatar", file)}
        onUploadCover={(file) => uploadImage("cover", file)}
        avatarUploading={avatarUploading}
        coverUploading={coverUploading}
        uploadError={uploadError}
      />

      {!profile.loading && person && (
        <div className="mt-5">
          <FriendsTabs tabs={TABS} activeTab={tab} onChange={setTab} />

          {(tab === "all" || tab === "about") && (
            <div className="mb-5">
              <AboutSection
                key={editingAbout && own ? "edit" : "view"}
                person={person}
                own={own}
                editing={editingAbout && own}
                onStartEdit={() => setEditingAbout(true)}
                onCancelEdit={() => setEditingAbout(false)}
                onSave={saveAbout}
              />
            </div>
          )}

          {(tab === "all" || tab === "posts") &&
            (person.hasBlockedMe || postsRestricted ? (
              <RestrictedPosts label="posts" />
            ) : (
              <>
                {own && (
                  <PostComposer
                    user={user}
                    body={body}
                    setBody={setBody}
                    imageFiles={imageFiles}
                    setImageFiles={setImageFiles}
                    busy={postBusy}
                    onSubmit={createPost}
                  />
                )}
                <PostList
                  posts={posts}
                  user={user}
                  onChanged={posts.reload}
                  onPostUpdated={patchPost}
                  onOpenPost={(postId) => navigate(`/app/post/${postId}`)}
                />
              </>
            ))}

          {tab === "photos" &&
            (person.hasBlockedMe ? (
              <RestrictedPosts label="photos" />
            ) : (
              <PhotosGrid photos={photos} own={own} />
            ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={
          confirmAction === "unfriend"
            ? `Unfriend ${person?.fullName}?`
            : `Block ${person?.fullName}?`
        }
        description={
          confirmAction === "unfriend"
            ? `You and ${person?.fullName} will no longer be friends. They won't be notified.`
            : `${person?.fullName} won't be able to send you friend requests or message you, and you'll be unfriended if you're currently connected. You can unblock them later from Friends → Blocked.`
        }
        confirmLabel={confirmAction === "unfriend" ? "Unfriend" : "Block"}
        variant="danger"
        loading={busy === confirmAction}
        onConfirm={confirmAction === "unfriend" ? unfriend : blockUser}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
