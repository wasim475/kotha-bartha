import { ResourceState } from "../../../utility/helpers";
import FriendCard from "./FriendCard";

const FriendList = ({ people, tab, onAction, onProfileClick }) => (
  <ResourceState
    loading={people.loading}
    error={people.error}
    empty={people.data?.length ? "" : `No ${tab} to show.`}
  >
    <div className="friend-grid">
      {people.data?.map((entry) => (
        <FriendCard
          key={entry.id || entry.user?.id}
          entry={entry}
          tab={tab}
          onAction={onAction}
          onProfileClick={onProfileClick}
        />
      ))}
    </div>
  </ResourceState>
);

export default FriendList;
