import NotificationItem from "./NotificationItem";

export default function NotificationList({
  notifications,
  onNotificationClick,
  onDelete,
  deletingIds,
  deleteErrors,
}) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel shadow-soft">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClick={onNotificationClick}
          onDelete={onDelete}
          deleting={deletingIds?.has(notification.id)}
          deleteError={deleteErrors?.[notification.id]}
        />
      ))}
    </div>
  );
}
