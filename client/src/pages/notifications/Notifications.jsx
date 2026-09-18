import { ResourceState } from "../../utility/helpers";

import NotificationHeader from "./components/NotificationHeader";
import NotificationList from "./components/NotificationList";
import useNotifications from "./hooks/useNotifications";

export default function Notifications() {
  const notifications = useNotifications();

  return (
    <>
      <NotificationHeader onMarkAllRead={notifications.markAllRead} />

      <ResourceState
        loading={notifications.loading}
        error={notifications.error}
        empty={!notifications.data?.length ? "You are all caught up." : ""}
      >
        <NotificationList
          notifications={notifications.data || []}
          onNotificationClick={notifications.handleNotificationClick}
        />
      </ResourceState>
    </>
  );
}
