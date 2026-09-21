import { useNavigate } from "react-router-dom";

import { api } from "../../utility/api";
import FriendList from "./components/FriendList";
import FriendsHeader from "./components/FriendsHeader";
import FriendsTabs from "./components/FriendsTabs";
import friendTabs from "./data/friendTabs";
import useFriends from "./hooks/useFriends";

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
    runAction,
  } = useFriends();

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
        onProfileClick={(id) => navigate(`/app/profile/${id}`)}
      />
    </>
  );
}
