import { useEffect } from "react";
import { io } from "socket.io-client";
import { api } from "../../../utility/api";
import { realtime, setActiveSocket } from "../../../utility/helpers";

const socketUrl = api.defaults.baseURL.replace(/\/api\/v1$/, "");

const messageSound = new Audio("/sounds/message.mp3");

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

    const handleNewMessage = (payload) => {
      // আগে existing realtime event পাঠাবে
      forward("message:new")(payload);

      // নতুন message এলে sound
      messageSound.currentTime = 0;

      messageSound.play().catch((error) => {
        console.error("Message sound failed:", error);
      });
    };

    socket.on("connect", forward("realtime:connected"));
    socket.on("message:new", handleNewMessage);
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
