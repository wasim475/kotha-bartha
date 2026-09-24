import { useEffect, useRef, useState } from "react";

import { api } from "../../../../utility/api";
import { activeSocket, realtime, useRealtime, useResource } from "../../../../utility/helpers";
import { apiErrorMessage } from "../../../../utility/ticTacToe";

// Keeps the freshest server state: a later move always wins, and a finished
// game is never turned back into an active one by a late, out-of-order event.
function mergeGame(current, incoming) {
  if (!incoming) return current;
  if (!current || current.id !== incoming.id) return current ?? incoming;

  const currentDone = current.status !== "active";
  const incomingDone = incoming.status !== "active";
  if (incoming.moveCount < current.moveCount) return current;
  if (incoming.moveCount === current.moveCount && currentDone && !incomingDone) return current;

  return { ...incoming, rematch: incoming.rematch !== undefined ? incoming.rematch : current.rematch };
}

/**
 * One Tic-Tac-Toe game, live. The server is the only authority: this hook
 * loads the state over REST, joins the game's Socket.IO room (re-joining on
 * every reconnect and page refresh, then taking the state the server returns),
 * applies moves/results the server pushes, and sends the player's tapped cell
 * back — nothing is decided here. `mySymbol` / `myTurn` are DISPLAY conveniences
 * derived from server data; the server re-checks identity and turn on every move.
 */
export default function useTicTacToeGame(gameId, userId) {
  const resource = useResource(`/games/tic-tac-toe/${gameId}`);
  const stats = useResource("/games/tic-tac-toe/stats");
  const [pendingCell, setPendingCell] = useState(null);
  const [moveError, setMoveError] = useState("");
  const [actionError, setActionError] = useState("");
  const [acting, setActing] = useState(false);

  const game = resource.data;
  // The room-join effect below runs once per game (not on every render), so it
  // reads the latest setter through a ref that is refreshed after each render.
  const setDataRef = useRef(resource.setData);
  useEffect(() => {
    setDataRef.current = resource.setData;
  });

  const apply = (incoming) => {
    resource.setData((current) => mergeGame(current, incoming));
    if (incoming && incoming.status !== "active") stats.reload();
  };

  // Join the room now and after every (re)connect; the server answers with the
  // current state, which is how a refresh or a dropped connection catches up.
  useEffect(() => {
    const join = () => {
      const socket = activeSocket;
      if (!socket?.connected) return;
      socket.emit("ticTacToe:join", { gameId }, (response) => {
        if (response?.ok) setDataRef.current((current) => mergeGame(current, response.game));
      });
    };
    join();
    realtime.addEventListener("realtime:connected", join);
    return () => {
      realtime.removeEventListener("realtime:connected", join);
      activeSocket?.emit("ticTacToe:leave", { gameId });
    };
  }, [gameId]);

  const forThisGame = (handler) => (event) => {
    if (event.detail?.gameId === gameId) handler(event.detail);
  };
  useRealtime("ticTacToe:move", forThisGame((detail) => apply(detail.game)));
  useRealtime("ticTacToe:state", forThisGame((detail) => apply(detail.game)));
  useRealtime("ticTacToe:finished", forThisGame((detail) => apply(detail.game)));
  useRealtime("ticTacToe:player:left", forThisGame((detail) => apply(detail.game)));

  // "Play again" traffic for THIS game (the popup itself is the global host's).
  const setRematch = (rematch) => resource.setData((current) => (current ? { ...current, rematch } : current));
  useRealtime("ticTacToe:rematch", (event) => {
    const invite = event.detail?.invite;
    if (invite?.previousGameId === gameId) {
      setRematch({ requestId: invite.id, direction: "incoming", status: "pending", expiresAt: invite.expiresAt });
    }
  });
  useRealtime("ticTacToe:rematch:declined", (event) => {
    if (game?.rematch?.requestId === event.detail?.requestId) {
      setRematch({ ...game.rematch, status: "declined" });
    }
  });
  const clearRematch = (event) => {
    if (game?.rematch?.requestId === event.detail?.requestId) setRematch(null);
  };
  useRealtime("ticTacToe:rematch:cancelled", clearRematch);
  useRealtime("ticTacToe:rematch:expired", clearRematch);

  const play = async (cellIndex) => {
    if (!game || game.status !== "active" || pendingCell !== null) return;
    setMoveError("");
    setPendingCell(cellIndex);
    try {
      const socket = activeSocket;
      if (socket?.connected) {
        const response = await new Promise((resolve) =>
          socket.timeout(6000).emit("ticTacToe:move", { gameId, cellIndex }, (error, result) =>
            resolve(error ? { ok: false, error: { message: "The connection is slow — try again." } } : result),
          ),
        );
        if (!response.ok) throw new Error(response.error?.message || "Couldn't play that move.");
        apply(response.game);
      } else {
        // Socket is down: the same validated move over plain HTTP.
        const { data } = await api.post(`/games/tic-tac-toe/${gameId}/move`, { cellIndex });
        apply(data.data.game);
      }
    } catch (error) {
      setMoveError(error.response ? apiErrorMessage(error, "Couldn't play that move.") : error.message);
      resource.reload(); // resync with whatever the server actually has
    } finally {
      setPendingCell(null);
    }
  };

  const run = async (request) => {
    setActing(true);
    setActionError("");
    try {
      return await request();
    } catch (error) {
      setActionError(apiErrorMessage(error));
      return null;
    } finally {
      setActing(false);
    }
  };

  const requestRematch = () =>
    run(async () => {
      const { data } = await api.post(`/games/tic-tac-toe/${gameId}/rematch`);
      setRematch({ requestId: data.data.id, direction: "outgoing", status: "pending", expiresAt: data.data.expiresAt });
    });

  const cancelRematch = () =>
    run(async () => {
      await api.post(`/games/tic-tac-toe/rematch/${game.rematch.requestId}/cancel`);
      setRematch(null);
    });

  const leave = () =>
    run(async () => {
      const { data } = await api.post(`/games/tic-tac-toe/${gameId}/leave`);
      return data.data.game;
    });

  const mySymbol = game ? (game.playerX.id === userId ? "X" : "O") : null;
  const opponent = game ? (mySymbol === "X" ? game.playerO : game.playerX) : null;
  const me = game ? (mySymbol === "X" ? game.playerX : game.playerO) : null;

  return {
    game,
    loading: resource.loading,
    error: resource.error,
    mySymbol,
    me,
    opponent,
    myTurn: Boolean(game && game.status === "active" && game.currentTurn === mySymbol),
    pendingCell,
    moveError,
    actionError,
    acting,
    stats: stats.data,
    play,
    requestRematch,
    cancelRematch,
    leave,
  };
}
