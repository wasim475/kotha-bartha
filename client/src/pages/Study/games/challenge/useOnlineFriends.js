import { useCallback, useEffect, useState } from "react";

import { api } from "../../../../utility/api";
import { useRealtime } from "../../../../utility/helpers";

const byName = (a, b) => a.fullName.localeCompare(b.fullName);

// One friend's latest presence change, applied to a list.
function applyChange(list, change) {
  if (!change.isOnline) return list.filter((item) => item.id !== change.userId);
  if (!change.user || list.some((item) => item.id === change.userId)) return list;
  return [...list, change.user].sort(byName);
}

/**
 * The friends who can be challenged right now: online (per the server's own
 * presence tracker), not blocked. Kept current by the same presence events the
 * Tic-Tac-Toe lobby uses — a friend coming online appears, one going offline
 * disappears, with no polling.
 *
 * A change that arrives while a list request is still in flight is remembered
 * and applied on top of that response (the response may have been computed just
 * before the change), and the list is re-fetched after a reconnect, when events
 * may have been missed.
 */
export default function useOnlineFriends() {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  // Latest change per friend, as state (not a ref) so the merge below stays a pure function of it.
  const [changes, setChanges] = useState({});

  const reload = useCallback(async () => {
    const startedAt = Date.now();
    try {
      const { data } = await api.get("/games/challenges/friends/online");
      setState({ data: data.data, loading: false, error: "" });
      // Changes from before this request are already reflected in the response;
      // only the ones that arrived while it was in flight still need replaying.
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
    const change = { userId, isOnline: Boolean(isOnline), user, at: Date.now() };
    setChanges((current) => ({ ...current, [userId]: change }));
  });

  // The list shown = the latest server response with every change seen since
  // this hook mounted layered on top (a change is never older than the truth it
  // corrects, so replaying them in place is safe).
  const data = state.data ? Object.values(changes).reduce(applyChange, state.data) : state.data;
  return { data, loading: state.loading, error: state.error, reload };
}
