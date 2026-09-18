import NotificationItem from "./NotificationItem";

export default function NotificationList({
  notifications,
  onNotificationClick,
}) {
  return (
    <div className="notification-list">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClick={onNotificationClick}
        />
      ))}
    </div>
  );
}
