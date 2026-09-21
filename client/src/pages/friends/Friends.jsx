import { useState } from "react";
import { useNavigate } from "react-router-dom";

import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { api } from "../../utility/api";
import FriendList from "./components/FriendList";
import FriendsHeader from "./components/FriendsHeader";
import FriendsTabs from "./components/FriendsTabs";
import friendTabs from "./data/friendTabs";
import useFriends from "./hooks/useFriends";

const confirmCopy = {
  unfriend: (name) => ({
    title: `Unfriend ${name}?`,
    description: `You and ${name} will no longer be friends. They won't be notified, and you can send a new friend request later if you change your mind.`,
    confirmLabel: "Unfriend",
    variant: "danger",
  }),
  block: (name) => ({
    title: `Block ${name}?`,
    description: `${name} won't be able to send you friend requests or message you, and you'll be unfriended if you're currently connected. You can unblock them anytime from the Blocked tab.`,
    confirmLabel: "Block",
    variant: "danger",
  }),
};

export default function Friends() {
  const navigate = useNavigate();
  const {
    tab,
    setTab,
    people,
    actingIds,
    rowErrors,
    acceptRequest,
    cancelRequest,
    unfriend,
    blockUser,
    unblockUser,
    runAction,
  } = useFriends();

  const [pendingConfirm, setPendingConfirm] = useState(null); // { type, entry }

  // Same "find or create a conversation, then open it" flow Profile.jsx
  // uses for its own Message button — reuses the existing endpoint rather
  // than adding anything new.
  const messageFriend = (entry) => {
    const person = entry.user || entry;
    runAction(person.id, async () => {
      const { data } = await api.post("/conversations", { userId: person.id });
      navigate(`/app/messages/${data.data.id}`);
    });
  };

  const requestUnfriend = (entry) => setPendingConfirm({ type: "unfriend", entry });
  const requestBlock = (entry) => setPendingConfirm({ type: "block", entry });
  const closeConfirm = () => setPendingConfirm(null);

  const confirmEntryId = pendingConfirm
    ? (pendingConfirm.entry.id ?? pendingConfirm.entry.user?.id)
    : null;
  const confirmLoading = confirmEntryId ? actingIds.has(confirmEntryId) : false;

  const runPendingConfirm = async () => {
    if (!pendingConfirm) return;
    const { type, entry } = pendingConfirm;
    if (type === "unfriend") await unfriend(entry);
    else if (type === "block") await blockUser(entry);
    setPendingConfirm(null);
  };

  const dialogCopy = pendingConfirm
    ? confirmCopy[pendingConfirm.type]((pendingConfirm.entry.user || pendingConfirm.entry).fullName)
    : null;

  return (
    <>
      <FriendsHeader />
      <FriendsTabs tabs={friendTabs} activeTab={tab} onChange={setTab} />
      <FriendList
        people={people}
        tab={tab}
        actingIds={actingIds}
        rowErrors={rowErrors}
        onAccept={acceptRequest}
        onCancel={cancelRequest}
        onMessage={messageFriend}
        onUnfriend={requestUnfriend}
        onBlock={requestBlock}
        onUnblock={unblockUser}
        onProfileClick={(id) => navigate(`/app/profile/${id}`)}
      />

      <ConfirmDialog
        open={Boolean(pendingConfirm)}
        title={dialogCopy?.title}
        description={dialogCopy?.description}
        confirmLabel={dialogCopy?.confirmLabel}
        variant={dialogCopy?.variant}
        loading={confirmLoading}
        onConfirm={runPendingConfirm}
        onCancel={closeConfirm}
      />
    </>
  );
}
