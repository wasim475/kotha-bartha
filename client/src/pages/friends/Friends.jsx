import { useNavigate } from "react-router-dom";

import "../../CSS/friend.css";

import FriendList from "./components/FriendList";
import FriendsHeader from "./components/FriendsHeader";
import FriendsTabs from "./components/FriendsTabs";
import friendTabs from "./data/friendTabs";
import useFriends from "./hooks/useFriends";

export default function Friends() {
  const navigate = useNavigate();
  const { tab, setTab, people, act } = useFriends();

  const handleFindPeople = () => {};

  return (
    <>
      <FriendsHeader onFindPeople={handleFindPeople} />
      <FriendsTabs tabs={friendTabs} activeTab={tab} onChange={setTab} />
      <FriendList
        people={people}
        tab={tab}
        onAction={act}
        onProfileClick={(id) => navigate(`/app/profile/${id}`)}
      />
    </>
  );
}
