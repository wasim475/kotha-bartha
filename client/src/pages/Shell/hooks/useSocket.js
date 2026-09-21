import { useEffect } from "react";
import { io } from "socket.io-client";
import { api } from "../../../utility/api";
import { isConversationMuted } from "../../../utility/conversationPreferences";
import { realtime, setActiveSocket } from "../../../utility/helpers";

const socketUrl = api.defaults.baseURL.replace(/\/api\/v1$/, "");
const forwardedMessageIds = new Set();

export default function useSocket(userId) {
  useEffect(() => {
    const socket = io(socketUrl, { withCredentials: true });

    setActiveSocket(socket);

    const forward = (name) => (payload) => {
      realtime.dispatchEvent(
        new CustomEvent(name, {
          detail: payload,
        }),
      );
    };

    const forwardNewMessage = (payload) => {
      const messageId = payload?.id ? String(payload.id) : null;

      if (messageId && forwardedMessageIds.has(messageId)) return;
      if (messageId) forwardedMessageIds.add(messageId);

      if (!isConversationMuted(userId, payload?.conversationId)) {
        const messageSound = new Audio("/sounds/message.mp3");
        messageSound.play().catch((error) => {
          console.error("Message sound failed:", error);
        });
      }

      if (
        document.hidden &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const desktopNotification = new Notification(
          payload?.sender?.fullName?.trim() || "Kotha-Barta",
          {
            body: payload?.body || "",
          },
        );

        desktopNotification.onclick = () => {
          window.focus();
          document.title = "kotha-barta";
          desktopNotification.close();
        };
      }

      forward("message:new")(payload);
    };

    socket.on("connect", () => { console.log("DEBUG socket connected", socket.id); forward("realtime:connected")(); });
    socket.on("connect_error", (err) => console.log("DEBUG socket connect_error", err.message));
    socket.on("message:new", forwardNewMessage);
    socket.on("message:updated", forward("message:updated"));
    socket.on("message:deleted", forward("message:deleted"));
    socket.on("message:reaction", forward("message:reaction"));
    socket.on("message:read", forward("message:read"));
    socket.on("notification:new", forward("notification:new"));
    socket.on("post:new", forward("post:new"));
    socket.on("friend:new", forward("friend:new"));
    socket.on("friend:accepted", forward("friend:accepted"));
    socket.on("typing:start", forward("typing:start"));
    socket.on("typing:stop", forward("typing:stop"));
    socket.on("call:signal", forward("call:signal"));
    socket.on("presence:update", forward("presence:update"));

    return () => {
      setActiveSocket(undefined);
      socket.disconnect();
    };
  }, [userId]);
}
