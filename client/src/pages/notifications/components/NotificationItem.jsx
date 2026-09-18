import { Avatar, formatTime } from "../../../utility/helpers";

export default function NotificationItem({ notification, onClick }) {
  return (
    <button
      className={`notification ${notification.read ? "" : "unread"}`}
      onClick={() => onClick(notification)}
    >
      <Avatar person={notification.actor} />

      <div>
        <strong>{notification.payload?.message || notification.type}</strong>

        <span>{formatTime(notification.createdAt)}</span>
      </div>

      {!notification.read && <i />}
    </button>
  );
}
