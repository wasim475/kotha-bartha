import { Block } from "@mui/icons-material";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import UiButton from "../../components/ui/Button";
import { api } from "../../utility/api";
import useButtonColorFix from "../../utility/useButtonColorFix";
import { Avatar, ResourceState, useResource } from "../../utility/helpers";

export default function Profile({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const profileId = id === "me" ? user.id : id;
  const profile = useResource(`/users/${profileId}`);
  const posts = useResource(`/users/${profileId}/posts`);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(null); // "friend" | "message" | "block" | "unblock" | null
  const [confirmBlock, setConfirmBlock] = useState(false);
  const blockFix = useButtonColorFix("outline");

  if (profile.loading) return <ResourceState loading />;
  if (profile.error) return <ResourceState error={profile.error} />;
  const person = profile.data;
  const own = profileId === user.id;
  const save = async () => {
    await api.patch("/users/me", { bio });
    setEditing(false);
    profile.reload();
  };
  const startMessage = async () => {
    if (busy) return;
    setBusy("message");
    try {
      const { data } = await api.post("/conversations", { userId: profileId });
      navigate(`/app/messages/${data.data.id}`);
    } catch (error) {
      console.log(
        error.response?.data?.error?.message || "Unable to start conversation.",
      );
    } finally {
      setBusy(null);
    }
  };

  const addFriend = async () => {
    if (busy) return;
    setBusy("friend");
    try {
      await api.post("/friends/requests", {
        receiverId: profileId,
      });

      profile.reload();
    } catch (error) {
      console.log(
        error.response?.data?.error?.message ||
          "Unable to send friend request.",
      );
    } finally {
      setBusy(null);
    }
  };

  const blockUser = async () => {
    if (busy) return;
    setBusy("block");
    try {
      await api.post(`/blocks/${profileId}`);
      profile.reload();
    } catch (error) {
      console.log(error.response?.data?.error?.message || "Unable to block user.");
    } finally {
      setBusy(null);
      setConfirmBlock(false);
    }
  };

  const unblockUser = async () => {
    if (busy) return;
    setBusy("unblock");
    try {
      await api.delete(`/blocks/${profileId}`);
      profile.reload();
    } catch (error) {
      console.log(error.response?.data?.error?.message || "Unable to unblock user.");
    } finally {
      setBusy(null);
    }
  };

  const editProfile = () => {
    setBio(person.bio || "");
    setEditing(!editing);
  };
  return (
    <>
      <div className="profile-cover">
        <div className="cover-text">
          {person.fullName.toLowerCase()} / in public
        </div>
      </div>
      <div className="profile-identity">
        <Avatar person={person} className="profile-avatar" />
        <div>
          <h1>{person.fullName}</h1>
          <p>{person.bio || "No bio yet."}</p>
        </div>
        {own ? (
          <button className="outline-button" onClick={editProfile}>
            Edit profile
          </button>
        ) : person.hasBlockedMe ? (
          <p className="text-sm text-muted">You can't interact with this profile.</p>
        ) : person.isBlocked ? (
          <div className="profile-actions">
            <UiButton
              size="sm"
              variant="outline"
              loading={busy === "unblock"}
              disabled={busy === "unblock"}
              onClick={unblockUser}
              style={blockFix.style}
              onMouseEnter={blockFix.onMouseEnter}
              onMouseLeave={blockFix.onMouseLeave}
            >
              Unblock
            </UiButton>
          </div>
        ) : (
          <div className="profile-actions">
            <button
              className="primary-button small"
              disabled={person.isFriend || person.friendRequestSent || busy === "friend"}
              onClick={addFriend}
            >
              {person.isFriend
                ? "Friend"
                : person.friendRequestSent
                  ? "Request Sent"
                  : busy === "friend"
                    ? "Sending…"
                    : "Add Friend"}
            </button>

            <button
              className="outline-button"
              disabled={busy === "message"}
              onClick={startMessage}
            >
              {busy === "message" ? "Opening…" : "Message"}
            </button>

            <UiButton
              size="sm"
              variant="outline"
              disabled={busy === "block"}
              onClick={() => setConfirmBlock(true)}
              style={blockFix.style}
              onMouseEnter={blockFix.onMouseEnter}
              onMouseLeave={blockFix.onMouseLeave}
              aria-label={`Block ${person.fullName}`}
            >
              <Block fontSize="small" />
              Block
            </UiButton>
          </div>
        )}
      </div>
      {editing && (
        <div className="composer profile-editor">
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            rows="3"
          />
          <button className="primary-button small" onClick={save}>
            Save profile
          </button>
        </div>
      )}
      <div className="profile-posts">
        <span className="eyebrow">Posts</span>
        <ResourceState
          loading={posts.loading}
          error={posts.error}
          empty={
            !posts.data?.length ? `${person.fullName} has not posted yet.` : ""
          }
        >
          {posts.data?.map((post) => (
            <article className="post-card" key={post.id}>
              <p className="post-body">{post.body}</p>
            </article>
          ))}
        </ResourceState>
      </div>

      <ConfirmDialog
        open={confirmBlock}
        title={`Block ${person.fullName}?`}
        description={`${person.fullName} won't be able to send you friend requests or message you, and you'll be unfriended if you're currently connected. You can unblock them later from Friends → Blocked.`}
        confirmLabel="Block"
        variant="danger"
        loading={busy === "block"}
        onConfirm={blockUser}
        onCancel={() => setConfirmBlock(false)}
      />
    </>
  );
}
