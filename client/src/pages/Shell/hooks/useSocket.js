import { useEffect } from "react";
import { io } from "socket.io-client";
import { api } from "../../../utility/api";
import { isConversationMuted } from "../../../utility/conversationPreferences";
import { realtime, setActiveSocket } from "../../../utility/helpers";
import { playIncomingMessageSound, playSoftMessageSound } from "../../../utility/sound";
import { GC_EVENTS } from "../../../utility/gameChallenge";
import { LUDO_EVENTS } from "../../../utility/ludo";
import { TTT_EVENTS } from "../../../utility/ticTacToe";

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

      // The server never broadcasts message:new back to its own sender, but
      // this guard makes that contract explicit here too rather than
      // relying purely on the absence of self-delivery elsewhere.
      const isOwnMessage = payload?.senderId && String(payload.senderId) === String(userId);

      if (!isOwnMessage && !isConversationMuted(userId, payload?.conversationId)) {
        // A conversation already open on screen gets a softer cue instead
        // of the full notification sound — read live each time (not from
        // a stale closure) since this handler is set up once per socket
        // connection, not re-created on navigation.
        const isConversationOpen =
          !document.hidden &&
          window.location.pathname === `/app/messages/${payload?.conversationId}`;

        if (isConversationOpen) playSoftMessageSound();
        else playIncomingMessageSound();
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

    socket.on("connect", forward("realtime:connected"));
    socket.on("message:new", forwardNewMessage);
    socket.on("message:updated", forward("message:updated"));
    socket.on("message:deleted", forward("message:deleted"));
    socket.on("message:reaction", forward("message:reaction"));
    socket.on("message:read", forward("message:read"));
    socket.on("notification:new", forward("notification:new"));
    socket.on("post:new", forward("post:new"));
    socket.on("story:new", forward("story:new"));
    socket.on("story:deleted", forward("story:deleted"));
    socket.on("friend:new", forward("friend:new"));
    socket.on("friend:accepted", forward("friend:accepted"));
    socket.on("typing:start", forward("typing:start"));
    socket.on("typing:stop", forward("typing:stop"));
    socket.on("call:signal", forward("call:signal"));
    socket.on("presence:update", forward("presence:update"));
    socket.on("conversation:updated", forward("conversation:updated"));
    socket.on("conversation:theme", forward("conversation:theme"));
    socket.on("conversation:likeEmoji", forward("conversation:likeEmoji"));
    // Tic-Tac-Toe invitations, moves and results (see utility/ticTacToe.js).
    TTT_EVENTS.forEach((name) => socket.on(name, forward(name)));
    // Friend quiz challenges (see utility/gameChallenge.js).
    GC_EVENTS.forEach((name) => socket.on(name, forward(name)));
    // Ludo lobbies, invitations and matches (see utility/ludo.js).
    LUDO_EVENTS.forEach((name) => socket.on(name, forward(name)));

    return () => {
      setActiveSocket(undefined);
      socket.disconnect();
    };
  }, [userId]);
}
