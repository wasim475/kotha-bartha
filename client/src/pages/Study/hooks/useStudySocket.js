import { useEffect } from "react";
import { io } from "socket.io-client";

import { api } from "../../../utility/api";
import { realtime, setActiveSocket } from "../../../utility/helpers";
import { GC_EVENTS } from "../../../utility/gameChallenge";
import { LUDO_EVENTS } from "../../../utility/ludo";
import { TTT_EVENTS } from "../../../utility/ticTacToe";

const socketUrl = api.defaults.baseURL.replace(/\/api\/v1$/, "");

// The Study section had no realtime connection, so a friend's Tic-Tac-Toe
// invitation could never reach someone reading Study pages. This opens the
// same authenticated Socket.IO connection the main shell uses, but forwards
// ONLY the connection signal and the Tic-Tac-Toe events — deliberately not the
// message sounds / desktop notifications the main shell's hook also handles,
// so Messages behaves exactly as before.
export default function useStudySocket(userId) {
  useEffect(() => {
    const socket = io(socketUrl, { withCredentials: true });
    setActiveSocket(socket);

    const forward = (name) => (payload) =>
      realtime.dispatchEvent(new CustomEvent(name, { detail: payload }));

    socket.on("connect", forward("realtime:connected"));
    TTT_EVENTS.forEach((name) => socket.on(name, forward(name)));
    GC_EVENTS.forEach((name) => socket.on(name, forward(name)));
    // Ludo lobbies, invitations and matches (see utility/ludo.js).
    LUDO_EVENTS.forEach((name) => socket.on(name, forward(name)));

    return () => {
      setActiveSocket(undefined);
      socket.disconnect();
    };
  }, [userId]);
}
