import { Avatar } from "../../../utility/helpers";

const FriendCard = ({
  entry,
  tab,
  onAction,
  onProfileClick,
}) => {
  const person = entry.user || entry;

  const handleAction = (event) => {
    // Button click করলে card-এর onClick trigger হবে না
    event.stopPropagation();

    onAction(entry);
  };

  const handleProfileClick = () => {
    onProfileClick(person.id);
  };

  return (
    <div
      className="friend-card"
      onClick={handleProfileClick}
      style={{ cursor: "pointer" }}
    >
      {/* Profile */}
      <div className="friend-card-profile">
        <Avatar person={person} />

        <div className="friend-card-info">
          <strong>{person.fullName}</strong>

          {/* Friend */}
          {tab === "friends" && (
            <span className="friend-card-status">
              Friend
            </span>
          )}

          {/* Incoming Request */}
          {tab === "requests" && (
            <div className="friend-card-actions">
              <button
                type="button"
                className="friend-confirm-button"
                onClick={handleAction}
              >
                Confirm
              </button>

              <button
                type="button"
                className="friend-delete-button"
                onClick={handleAction}
              >
                Delete
              </button>
            </div>
          )}

          {/* Sent Request */}
          {tab === "sent" && (
            <div className="friend-card-actions">
              <button
                type="button"
                className="friend-cancel-button"
                onClick={handleAction}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendCard;