import NotificationItem from "./NotificationItem";

export default function NotificationList({
  notifications,
  onNotificationClick,
}) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel shadow-soft">
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
