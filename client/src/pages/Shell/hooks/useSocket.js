import { useEffect } from "react";
import { io } from "socket.io-client";

import { api } from "../../../utility/api";
import { realtime, setActiveSocket } from "../../../utility/helpers";

const socketUrl = api.defaults.baseURL.replace(/\/api\/v1$/, "");

export default function useSocket(userId) {
  useEffect(() => {
    const socket = io(socketUrl, { withCredentials: true });
    setActiveSocket(socket);

    const forward = (name) => (payload) =>
      realtime.dispatchEvent(new CustomEvent(name, { detail: payload }));

    socket.on("connect", forward("realtime:connected"));
    socket.on("message:new", forward("message:new"));
    socket.on("notification:new", forward("notification:new"));
    socket.on("call:signal", forward("call:signal"));

    return () => {
      setActiveSocket(undefined);
      socket.disconnect();
    };
  }, [userId]);
}
