import { useCallback, useEffect, useRef, useState } from "react";

import { activeSocket, useRealtime } from "../../../../utility/helpers";
import { isGameReaction } from "../../../../utility/ticTacToe";

const VISIBLE_MS = 1700; // how long one reaction stays on screen
const MAX_VISIBLE = 6; // older ones are dropped, so the screen never fills up
const COOLDOWN_MS = 450; // matches the server's own per-player limit

/**
 * In-game reactions for ONE game: what to show, and how to send. They are only
 * visual — nothing here (or on the server) touches the board, turn, timer,
 * score or result.
 *
 * Rendering strategy (one, so nothing shows twice):
 *   - a reaction the OTHER player sends arrives over the socket and is shown;
 *   - a reaction I send is shown once, when the server acknowledges it (the
 *     server relays to everyone in the room EXCEPT my own socket).
 * Each reaction lives in `items` for VISIBLE_MS and is then removed.
 */
export default function useGameReactions(gameId, userId) {
  const [items, setItems] = useState([]); // { key, gameId, from, type }
  const [cooling, setCooling] = useState(false);
  const [error, setError] = useState("");
  const timers = useRef(new Set());
  const counter = useRef(0);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);

  const show = useCallback(
    (from, type) => {
      const key = ++counter.current;
      setItems((current) => [...current.slice(-(MAX_VISIBLE - 1)), { key, gameId, from, type }]);
      later(() => setItems((current) => current.filter((item) => item.key !== key)), VISIBLE_MS);
    },
    [gameId, later],
  );

  useRealtime("ticTacToe:reaction", (event) => {
    const { gameId: forGame, from, type } = event.detail || {};
    if (forGame === gameId && isGameReaction(type)) show(from, type);
  });

  const send = async (type) => {
    if (cooling || !isGameReaction(type)) return;
    setCooling(true);
    later(() => setCooling(false), COOLDOWN_MS);
    setError("");

    const socket = activeSocket;
    if (!socket?.connected) {
      setError("You're offline — reconnecting…");
      return;
    }
    const response = await new Promise((resolve) =>
      socket.timeout(4000).emit("ticTacToe:reaction", { gameId, type }, (failure, result) =>
        resolve(failure ? { ok: false } : result),
      ),
    );
    if (response.ok) show(userId, type);
    else if (response.error?.code !== "RATE_LIMITED") setError(response.error?.message || "Couldn't send that.");
  };

  return { items: items.filter((item) => item.gameId === gameId), cooling, error, send };
}
