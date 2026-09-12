import { useNavigate } from "react-router-dom";
import { api } from "../../utility/api";
import { Avatar, ResourceState, formatTime, useRealtime, useResource } from "../../utility/helpers";

export default function Notifications() {
  const navigate = useNavigate(); const notifications = useResource("/notifications");
  useRealtime("notification:new", notifications.reload); useRealtime("realtime:connected", notifications.reload);
  const markAllRead = async () => { await api.post("/notifications/read-all"); notifications.reload(); };
  return <><div className="page-heading"><div><span className="eyebrow">Stay in the loop</span><h1>Notifications</h1></div><button className="text-button" onClick={markAllRead}>Mark all read</button></div>
  
  <ResourceState
  loading={notifications.loading}
  error={notifications.error}
  empty={
    !notifications.data?.length
      ? "You are all caught up."
      : ""
  }
>
  <div className="notification-list">
    {notifications.data?.map((notification) => (
      <button
        className={`notification ${notification.read ? "" : "unread"}`}
        key={notification.id}
        onClick={() =>
          notification.type === "friend_request" &&
          navigate("/app/friends")
        }
      >
        <Avatar person={notification.actor} />

        <div>
          <strong>
            {notification.payload?.message || notification.type}
          </strong>
          <span>{formatTime(notification.createdAt)}</span>
        </div>

        {!notification.read && <i />}
      </button>
    ))}
  </div>
</ResourceState>
  
  </>;
}
