import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../utility/api";
import { realtime, useRealtime, useResource } from "../../../utility/helpers";

export default function useNotifications() {
  const navigate = useNavigate();
  const notifications = useResource("/notifications");
  const [deletingIds, setDeletingIds] = useState(() => new Set());
  const [deleteErrors, setDeleteErrors] = useState({});

  useRealtime("notification:new", notifications.reload);
  useRealtime("realtime:connected", notifications.reload);

  const markAllRead = async () => {
    await api.post("/notifications/read-all");
    notifications.reload();
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      try {
        await api.post(`/notifications/${notification.id}/read`);
      } catch (error) {
        if (error.response?.status !== 404) {
          console.error("Unable to mark notification as read:", error);
        }
      } finally {
        notifications.reload();
      }
    }

    if (
      notification.type === "friend_request" ||
      notification.type === "friend_accepted"
    ) {
      navigate("/app/friends");
      return;
    }

    if (notification.postId) {
      const params = new URLSearchParams();
      if (notification.commentId) params.set("commentId", notification.commentId);
      if (notification.replyId) params.set("replyId", notification.replyId);
      const query = params.toString();
      navigate(`/app/post/${notification.postId}${query ? `?${query}` : ""}`);
    }
  };

  const deleteNotification = async (notification) => {
    if (deletingIds.has(notification.id)) return;

    setDeletingIds((current) => new Set(current).add(notification.id));
    setDeleteErrors((current) => {
      if (!(notification.id in current)) return current;
      const next = { ...current };
      delete next[notification.id];
      return next;
    });

    try {
      await api.delete(`/notifications/${notification.id}`);
      notifications.setData((current = []) =>
        current.filter((item) => item.id !== notification.id),
      );
      // Mirrors the "notification:new" badge bump in useUnreadCounts with a
      // symmetric local-only decrement — this never goes over the wire, it
      // just reuses the same in-tab event bus.
      if (!notification.read) {
        realtime.dispatchEvent(new CustomEvent("notification:deleted", { detail: { wasUnread: true } }));
      }
    } catch {
      setDeleteErrors((current) => ({
        ...current,
        [notification.id]: "Couldn't delete this notification. Try again.",
      }));
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(notification.id);
        return next;
      });
    }
  };

  return {
    ...notifications,
    markAllRead,
    handleNotificationClick,
    deleteNotification,
    deletingIds,
    deleteErrors,
  };
}
