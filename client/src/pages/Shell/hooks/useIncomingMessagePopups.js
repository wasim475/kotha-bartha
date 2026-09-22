import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRealtime } from "../../../utility/helpers";

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 6000;
const isDesktopViewport = () =>
  typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;

// Desktop-only floating "new message" toasts — separate from the existing
// in-app Notifications feature and from the OS-level Notification already
// sent (see useSocket.js) when the tab is hidden; this only ever shows
// while the tab is visible, so the two never fire for the same event.
export default function useIncomingMessagePopups(userId) {
  const [toasts, setToasts] = useState([]);
  const navigate = useNavigate();
  const shownIds = useRef(new Set());
  const timers = useRef(new Map());

  const dismissToast = (id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((current) => current.map((t) => (t.id === id ? { ...t, closing: true } : t)));
  };

  const removeToast = (id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  };

  const openToast = (toast) => {
    dismissToast(toast.id);
    navigate(`/app/messages/${toast.conversationId}`);
  };

  useRealtime("message:new", (event) => {
    const payload = event.detail || {};
    const messageId = payload.id ? String(payload.id) : null;
    if (!messageId || shownIds.current.has(messageId)) return;

    // Own messages never reach here in practice (the server doesn't
    // broadcast message:new back to the sender), but this keeps the
    // requirement true even if that ever changes.
    if (payload.senderId && String(payload.senderId) === String(userId)) return;

    if (document.hidden) return; // OS notification already covers this
    if (!isDesktopViewport()) return;

    const openConversationPath = `/app/messages/${payload.conversationId}`;
    if (window.location.pathname === openConversationPath) return;

    shownIds.current.add(messageId);

    const toast = {
      id: messageId,
      conversationId: payload.conversationId,
      sender: payload.sender || null,
      preview: payload.encrypted ? "🔒 Encrypted message" : payload.body || "Sent an attachment",
      closing: false,
    };

    setToasts((current) => {
      const next = [...current, toast];
      // Cap how many stack up at once — drop the oldest still-active one
      // rather than letting them pile up indefinitely.
      if (next.length > MAX_VISIBLE) {
        const [oldest, ...rest] = next;
        clearTimeout(timers.current.get(oldest.id));
        timers.current.delete(oldest.id);
        return rest;
      }
      return next;
    });

    timers.current.set(
      messageId,
      setTimeout(() => dismissToast(messageId), AUTO_DISMISS_MS),
    );
  });

  useEffect(() => {
    const timersMap = timers.current;
    return () => {
      timersMap.forEach((timeoutId) => clearTimeout(timeoutId));
      timersMap.clear();
    };
  }, []);

  return { toasts, dismissToast, removeToast, openToast };
}
