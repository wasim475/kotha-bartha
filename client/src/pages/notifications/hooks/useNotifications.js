import { useNavigate } from "react-router-dom";
import { api } from "../../../utility/api";
import { useRealtime, useResource } from "../../../utility/helpers";

export default function useNotifications() {
  const navigate = useNavigate();
  const notifications = useResource("/notifications");

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

  return {
    ...notifications,
    markAllRead,
    handleNotificationClick,
  };
}
