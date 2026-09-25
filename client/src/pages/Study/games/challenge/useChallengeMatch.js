import { useCallback, useEffect, useState } from "react";

import { api } from "../../../../utility/api";
import { apiErrorMessage } from "../../../../utility/gameChallenge";
import { activeSocket, realtime, useRealtime } from "../../../../utility/helpers";

// After the LAST question resolves, its result stays on screen this long before
// the final result screen replaces it (skipped when opening a finished match).
const FINAL_REVEAL_DELAY_MS = 2400;

// Keeps the freshest server state: every view carries a `version` that only
// grows, so a late or out-of-order event can never move the match backwards.
function mergeMatch(current, incoming) {
  if (!incoming) return current;
  if (!current || current.id !== incoming.id) return incoming;
  if (incoming.version < current.version) return current;
  return { ...incoming, rematch: incoming.rematch !== undefined ? incoming.rematch : current.rematch };
}

/**
 * One friend challenge, live. The server is the only authority: this hook loads
 * the player's own view over REST, joins the match's Socket.IO room (re-joining
 * on every reconnect and page refresh — the state, the clock and the player's
 * answer all come from the database), applies what the server pushes, and sends
 * the tapped option position back. Nothing about correctness, timing, scores or
 * the winner is decided here.
 */
export default function useChallengeMatch(matchId) {
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingPosition, setPendingPosition] = useState(null);
  const [answerError, setAnswerError] = useState("");
  const [actionError, setActionError] = useState("");
  const [acting, setActing] = useState(false);
  // Did we see this match still being played during this visit? If so its last
  // question's result is shown before the final screen; a match opened already
  // finished — or one somebody LEFT — shows its outcome at once.
  const [watched, setWatched] = useState(false);
  const [revealedId, setRevealedId] = useState(null);

  const apply = useCallback((incoming) => {
    if (!incoming) return;
    setMatch((current) => mergeMatch(current, incoming));
    if (incoming.status === "active") setWatched(true);
  }, []);

  const status = match?.status;
  const id = match?.id;
  useEffect(() => {
    if (!watched || status !== "completed") return undefined;
    const timer = setTimeout(() => setRevealedId(id), FINAL_REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [watched, status, id]);
  const finalRevealed = Boolean(match) && status !== "active" && (!watched || status === "abandoned" || revealedId === id);

  // Initial load over REST (also the fallback when the socket is down).
  useEffect(() => {
    let alive = true;
    api
      .get(`/games/challenges/${matchId}`)
      .then(({ data }) => {
        if (!alive) return;
        apply(data.data.match);
        setLoading(false);
      })
      .catch((requestError) => {
        if (!alive) return;
        setError(apiErrorMessage(requestError, "Couldn't load this match."));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [matchId, apply]);

  // Join the room now and after every (re)connect; the server settles the match
  // against its own clock and answers with the current state.
  useEffect(() => {
    const join = () => {
      const socket = activeSocket;
      if (!socket?.connected) return;
      socket.emit("gameChallenge:join", { matchId }, (response) => {
        if (response?.ok) apply(response.match);
      });
    };
    join();
    realtime.addEventListener("realtime:connected", join);
    return () => {
      realtime.removeEventListener("realtime:connected", join);
      activeSocket?.emit("gameChallenge:room:leave", { matchId });
    };
  }, [matchId, apply]);

  const forThisMatch = (handler) => (event) => {
    if (event.detail?.matchId === matchId) handler(event.detail);
  };
  useRealtime("gameChallenge:question", forThisMatch((detail) => apply(detail.match)));
  useRealtime("gameChallenge:questionResult", forThisMatch((detail) => apply(detail.match)));
  useRealtime("gameChallenge:finished", forThisMatch((detail) => apply(detail.match)));
  useRealtime("gameChallenge:player:left", forThisMatch((detail) => apply(detail.match)));
  // The opponent locked in an answer: an indicator only — never which option.
  useRealtime(
    "gameChallenge:answer",
    forThisMatch((detail) =>
      setMatch((current) =>
        current?.current && current.current.index === detail.questionIndex
          ? { ...current, current: { ...current.current, opponentAnswered: true } }
          : current,
      ),
    ),
  );

  // "Play again" traffic for THIS match (the popup itself is the global host's).
  const setRematch = (rematch) => setMatch((current) => (current ? { ...current, rematch } : current));
  useRealtime("gameChallenge:rematch", (event) => {
    const invite = event.detail?.invite;
    if (invite?.previousMatchId === matchId) {
      setRematch({ requestId: invite.id, direction: "incoming", status: "pending", expiresAt: invite.expiresAt });
    }
  });
  useRealtime("gameChallenge:rematchDeclined", (event) => {
    if (match?.rematch?.requestId === event.detail?.requestId) setRematch({ ...match.rematch, status: "declined" });
  });
  const clearRematch = (event) => {
    if (match?.rematch?.requestId === event.detail?.requestId) setRematch(null);
  };
  useRealtime("gameChallenge:rematchCancelled", clearRematch);
  useRealtime("gameChallenge:rematchExpired", clearRematch);

  const answer = async (position) => {
    const current = match?.current;
    if (!current || current.answered || pendingPosition !== null) return;
    setAnswerError("");
    setPendingPosition(position);
    const body = { matchId, questionIndex: current.index, selectedPosition: position };
    try {
      const socket = activeSocket;
      if (socket?.connected) {
        const response = await new Promise((resolve) =>
          socket.timeout(6000).emit("gameChallenge:answer", body, (failure, result) =>
            resolve(failure ? { ok: false, error: { message: "The connection is slow — try again." } } : result),
          ),
        );
        if (!response.ok) throw new Error(response.error?.message || "Couldn't send that answer.");
        apply(response.match);
      } else {
        const { data } = await api.post(`/games/challenges/${matchId}/answer`, { questionIndex: current.index, selectedPosition: position });
        apply(data.data.match);
      }
    } catch (failure) {
      setAnswerError(failure.response ? apiErrorMessage(failure, "Couldn't send that answer.") : failure.message);
      // Resync with whatever the server actually has (the question may have closed).
      api.get(`/games/challenges/${matchId}`).then(({ data }) => apply(data.data.match)).catch(() => {});
    } finally {
      setPendingPosition(null);
    }
  };

  const run = async (request) => {
    setActing(true);
    setActionError("");
    try {
      return await request();
    } catch (failure) {
      setActionError(apiErrorMessage(failure));
      return null;
    } finally {
      setActing(false);
    }
  };

  const requestRematch = () =>
    run(async () => {
      const { data } = await api.post(`/games/challenges/${matchId}/rematch`);
      setRematch({ requestId: data.data.id, direction: "outgoing", status: "pending", expiresAt: data.data.expiresAt });
    });

  const cancelRematch = () =>
    run(async () => {
      await api.post(`/games/challenges/rematch/${match.rematch.requestId}/cancel`);
      setRematch(null);
    });

  const leave = () =>
    run(async () => {
      const { data } = await api.post(`/games/challenges/${matchId}/leave`);
      return data.data.match;
    });

  return { match, loading, error, pendingPosition, answerError, actionError, acting, finalRevealed, answer, requestRematch, cancelRematch, leave };
}
