import { useCallback, useEffect, useState } from "react";

import { api } from "../../../../../utility/api";
import { useRealtime } from "../../../../../utility/helpers";

const byName = (a, b) => a.fullName.localeCompare(b.fullName);

function applyChange(list, change) {
  if (!change.isOnline) return list.filter((item) => item.id !== change.userId);
  if (!change.user || list.some((item) => item.id === change.userId)) return list;
  return [...list, change.user].sort(byName);
}

/**
 * The friends who can be invited to Ludo right now: online per the server's own
 * presence tracker, not blocked. Kept current by the existing presence events —
 * a friend coming online appears, one going offline disappears, no polling — and
 * re-fetched after a reconnect, when events may have been missed. (Same logic as
 * the challenge / Tic-Tac-Toe lists; only the endpoint differs.)
 */
export default function useLudoFriends() {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const [changes, setChanges] = useState({});

  const reload = useCallback(async () => {
    const startedAt = Date.now();
    try {
      const { data } = await api.get("/games/ludo/friends/online");
      setState({ data: data.data, loading: false, error: "" });
      setChanges((current) => Object.fromEntries(Object.entries(current).filter(([, change]) => change.at >= startedAt)));
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.response?.data?.error?.message || "Unable to load friends." }));
    }
  }, []);

  useEffect(() => {
    // Initial load; state is set after the response.
    reload();
  }, [reload]);

  useRealtime("realtime:connected", reload);
  useRealtime("ticTacToe:presence", (event) => {
    const { userId, isOnline, user } = event.detail || {};
    if (!userId) return;
    setChanges((current) => ({ ...current, [userId]: { userId, isOnline: Boolean(isOnline), user, at: Date.now() } }));
  });

  const data = state.data ? Object.values(changes).reduce(applyChange, state.data) : state.data;
  return { data, loading: state.loading, error: state.error, reload };
}
