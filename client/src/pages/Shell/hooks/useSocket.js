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

      forward("message:new")(payload);
    };

    socket.on("connect", forward("realtime:connected"));
    socket.on("message:new", forwardNewMessage);
    socket.on("message:reaction", forward("message:reaction"));
    socket.on("message:read", forward("message:read"));
    socket.on("notification:new", forward("notification:new"));
    socket.on("typing:start", forward("typing:start"));
    socket.on("typing:stop", forward("typing:stop"));
    socket.on("call:signal", forward("call:signal"));

    return () => {
      setActiveSocket(undefined);
      socket.disconnect();
    };
  }, [userId]);
}
