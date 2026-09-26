import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../../../../../utility/api";
import { activeSocket, useRealtime } from "../../../../../utility/helpers";
import { apiErrorMessage } from "../../../../../utility/ludo";
import { ludoSfx } from "../../../../../utility/ludoSound";

const newActionId = () => {
  try {
    return crypto.randomUUID().replaceAll("-", "");
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
};

const CODES_THAT_NEED_A_RESYNC = new Set(["STALE_VERSION", "NOT_YOUR_TURN", "ALREADY_ROLLED", "MUST_ROLL", "ILLEGAL_MOVE", "GAME_NOT_ACTIVE", "GAME_FINISHED"]);

/**
 * One online Ludo game, live. The server is the only authority: this hook loads
 * the state over REST, joins the game's Socket.IO room (again on every reconnect
 * and refresh, taking the full snapshot the server returns), applies the updates
 * the server pushes, and sends the player's INTENTIONS back — "roll", "move
 * token 2" — with the version it last saw. It never sends or computes a dice
 * value, a position, a turn or a winner. `mySeat` is a display convenience the
 * server re-checks on every action.
 */
export default function useLudoOnline(gameId, director) {
  const [view, setView] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [connection, setConnection] = useState(() => (activeSocket?.connected ? "connected" : "connecting"));
  const [pendingRoll, setPendingRoll] = useState(false);
  const [pendingKey, setPendingKey] = useState(null);
  const [hint, setHint] = useState("");
  const [takenOver, setTakenOver] = useState(false);
  const [chat, setChat] = useState([]);
  const [emotes, setEmotes] = useState([]);
  const [offsetMs, setOffsetMs] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const versionRef = useRef(-1);
  const viewRef = useRef(null);
  const directorRef = useRef(director);
  useEffect(() => {
    directorRef.current = director;
  });

  const remember = (next) => {
    viewRef.current = next;
    setView(next);
  };

  const noteClock = useCallback((serverNow) => {
    if (typeof serverNow === "number") setOffsetMs(serverNow - Date.now());
  }, []);

  // Full replacement from a snapshot the server sent (initial load, reconnect, resync).
  const adopt = useCallback(
    (next) => {
      if (!next || next.id !== gameId) return;
      const version = next.game?.version ?? -1;
      if (version < versionRef.current && viewRef.current?.status === next.status) return;
      versionRef.current = version;
      const merged = { ...viewRef.current, ...next };
      remember(merged);
      noteClock(next.serverNow);
      if (next.game) directorRef.current.snap(next.game);
    },
    [gameId, noteClock],
  );

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/games/ludo/${gameId}`);
      adopt(data.data);
      setStatus({ loading: false, error: "" });
      return data.data;
    } catch (error) {
      setStatus({ loading: false, error: apiErrorMessage(error, "Couldn't load this game.") });
      return null;
    }
  }, [adopt, gameId]);

  const resync = useCallback(async () => {
    setSyncing(true);
    versionRef.current = -1;
    await load();
    setSyncing(false);
  }, [load]);

  // Join the room now and after every (re)connect; the server answers with the
  // authoritative state — that is how a refresh or a dropped connection catches up.
  const join = useCallback(() => {
    const socket = activeSocket;
    if (!socket?.connected) return;
    socket.emit("ludo:join", { gameId }, (response) => {
      if (response?.ok) {
        setTakenOver(false);
        adopt(response.game);
        setStatus({ loading: false, error: "" });
      } else if (response?.error?.code === "NOT_FOUND") {
        setStatus({ loading: false, error: "This game isn't available." });
      }
    });
  }, [adopt, gameId]);

  useEffect(() => {
    // Initial load; state is set after the response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    join();
    return () => activeSocket?.emit("ludo:leave", { gameId });
  }, [gameId, load, join]);
  useRealtime("realtime:connected", join);

  // Connection indicator — "Reconnecting…" instead of a silent freeze. The browser
  // tells us at once when the network goes away (the socket itself can take a while
  // to notice); when it comes back we re-sync from the server.
  useEffect(() => {
    const check = () => setConnection(activeSocket?.connected && navigator.onLine !== false ? "connected" : "reconnecting");
    const goOffline = () => setConnection("reconnecting");
    const goOnline = () => {
      check();
      activeSocket?.connect?.();
    };
    const id = setInterval(check, 1000);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      clearInterval(id);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  // A server update: apply it once, in order. A gap means something was missed —
  // take a full snapshot instead of animating a story with holes in it.
  const applyUpdate = useCallback(
    (payload) => {
      if (payload.gameId !== gameId) return;
      const version = payload.version;
      if (payload.snapshot) {
        if (version >= versionRef.current) {
          versionRef.current = version;
          noteClock(payload.serverNow);
          if (payload.game) {
            remember({ ...viewRef.current, game: payload.game, status: payload.status, results: payload.results, finishedAt: payload.finishedAt, durationSec: payload.durationSec, finishReason: payload.finishReason });
            directorRef.current.snap(payload.game);
          }
        }
        return;
      }
      if (version <= versionRef.current) return;
      const gap = versionRef.current >= 0 && version > versionRef.current + 1;
      versionRef.current = version;
      noteClock(payload.serverNow);
      if (payload.game) {
        remember({ ...viewRef.current, game: payload.game, status: payload.status, results: payload.results, finishedAt: payload.finishedAt, durationSec: payload.durationSec, finishReason: payload.finishReason });
        if (gap) directorRef.current.snap(payload.game);
        else directorRef.current.play(payload.events || [], payload.game);
      }
    },
    [gameId, noteClock],
  );
  useRealtime("ludo:state", (event) => applyUpdate(event.detail || {}));
  useRealtime("ludo:lobby", (event) => {
    if (event.detail?.gameId === gameId) adopt(event.detail.game);
  });
  useRealtime("ludo:started", (event) => {
    if (event.detail?.gameId === gameId) adopt(event.detail.game);
  });
  useRealtime("ludo:takeover", (event) => {
    if (event.detail?.gameId === gameId) setTakenOver(true);
  });

  // Chat + reactions (decorative — they never touch the game).
  useRealtime("ludo:chat", (event) => {
    const message = event.detail;
    if (message?.gameId !== gameId) return;
    setChat((current) => [...current.slice(-39), { ...message, id: `${message.at}-${message.from?.id}` }]);
    if (message.from?.id !== viewRef.current?.game?.players?.find((p) => p.seat === viewRef.current?.mySeat)?.user?.id) ludoSfx.chat();
  });
  useRealtime("ludo:reaction", (event) => {
    const reaction = event.detail;
    if (reaction?.gameId !== gameId) return;
    const id = `${reaction.at}-${reaction.from}-${Math.random().toString(36).slice(2, 6)}`;
    setEmotes((current) => [...current.slice(-5), { ...reaction, id }]);
    ludoSfx.reaction();
    setTimeout(() => setEmotes((current) => current.filter((item) => item.id !== id)), 2200);
  });

  const send = useCallback(
    async (event, body, httpAction) => {
      const socket = activeSocket;
      const actionId = newActionId();
      const payload = { gameId, expectedVersion: versionRef.current, actionId, ...body };
      if (socket?.connected) {
        return new Promise((resolve) =>
          socket.timeout(7000).emit(event, payload, (error, result) => resolve(error ? { ok: false, error: { code: "TIMEOUT", message: "The connection is slow — checking the game…" } } : result)),
        );
      }
      // The socket is down: the same validated action over plain HTTP.
      try {
        const { data } = await api.post(`/games/ludo/${gameId}/actions`, { ...httpAction, expectedVersion: versionRef.current, actionId });
        return { ok: true, ...data.data };
      } catch (error) {
        return { ok: false, error: { code: error.response?.data?.error?.code, message: apiErrorMessage(error, "Couldn't do that.") } };
      }
    },
    [gameId],
  );

  const settle = useCallback(
    async (response) => {
      if (response.ok) {
        setHint("");
        // The broadcast normally arrives first; the acknowledgement covers a lost one.
        if (response.game?.game) applyUpdate({ gameId, version: response.game.game.version, serverNow: response.game.serverNow, events: response.events || [], game: response.game.game, status: response.game.status, results: response.game.results, finishedAt: response.game.finishedAt, durationSec: response.game.durationSec, finishReason: response.game.finishReason });
        return;
      }
      directorRef.current.cancelRoll();
      setHint(response.error?.message || "Couldn't do that.");
      if (response.error?.code === "NOT_CONTROLLER") setTakenOver(true);
      else if (CODES_THAT_NEED_A_RESYNC.has(response.error?.code) || response.error?.code === "TIMEOUT") await resync();
    },
    [applyUpdate, gameId, resync],
  );

  const roll = useCallback(async () => {
    if (pendingRoll || pendingKey || takenOver) return;
    directorRef.current.beginRoll();
    setPendingRoll(true);
    try {
      await settle(await send("ludo:roll", {}, { type: "ROLL_DICE" }));
    } finally {
      setPendingRoll(false);
    }
  }, [pendingRoll, pendingKey, takenOver, send, settle]);

  const pick = useCallback(
    async (tokenId) => {
      if (pendingRoll || pendingKey || takenOver) return;
      const seat = viewRef.current?.mySeat;
      setPendingKey(`${seat}:${tokenId}`);
      try {
        await settle(await send("ludo:move", { tokenId }, { type: "SELECT_TOKEN", tokenId }));
      } finally {
        setPendingKey(null);
      }
    },
    [pendingRoll, pendingKey, takenOver, send, settle],
  );

  const takeControl = useCallback(() => {
    join();
  }, [join]);

  const sendChat = useCallback(
    (text) =>
      new Promise((resolve) => {
        if (!activeSocket?.connected) return resolve({ ok: false, error: { message: "You're offline." } });
        activeSocket.timeout(5000).emit("ludo:chat", { gameId, text }, (error, result) => resolve(error ? { ok: false, error: { message: "Couldn't send." } } : result));
      }),
    [gameId],
  );

  const sendReaction = useCallback(
    (type) =>
      new Promise((resolve) => {
        if (!activeSocket?.connected) return resolve({ ok: false });
        activeSocket.timeout(5000).emit("ludo:reaction", { gameId, type }, (error, result) => resolve(error ? { ok: false } : result));
      }),
    [gameId],
  );

  const leave = useCallback(async () => {
    try {
      const { data } = await api.post(`/games/ludo/${gameId}/leave`);
      adopt(data.data.game);
      return true;
    } catch (error) {
      setHint(apiErrorMessage(error, "Couldn't leave the game."));
      return false;
    }
  }, [adopt, gameId]);

  const requestRematch = useCallback(async () => {
    const { data } = await api.post(`/games/ludo/${gameId}/rematch`);
    return data.data.game;
  }, [gameId]);

  // A rematch lobby exists for this game: the finished screen offers to go there.
  useRealtime("ludo:rematch", (event) => {
    const invite = event.detail?.invite;
    if (!invite) return;
    const previous = viewRef.current;
    if (previous?.status === "finished") remember({ ...previous, rematch: { gameId: invite.gameId, status: "lobby", hostId: invite.from?.id, invite: { id: invite.id, status: "pending", expiresAt: invite.expiresAt } } });
  });
  useRealtime("ludo:rematch:accepted", () => load());
  return { view, status, connection, pendingRoll, pendingKey, hint, takenOver, chat, emotes, offsetMs, syncing, roll, pick, resync, takeControl, sendChat, sendReaction, leave, requestRematch, reload: load };
}
