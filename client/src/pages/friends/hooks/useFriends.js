import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../../../utility/api";

// entries look different per tab: `friends` returns bare person objects,
// `requests`/`sent` return { id: <requestId>, user: <person> } — this picks
// whichever id makes sense as the row's stable identity either way.
const rowId = (entry) => entry.id ?? entry.user?.id;

/**
 * Friends/Requests/Sent data + actions. Rebuilt on top of a local fetch
 * (rather than the shared `useResource`) so switching tabs can flip
 * `loading` back on in the very same render as the tab change — with
 * `useResource`, the previous tab's data stayed on screen, unchanged,
 * for the entire round-trip of the new tab's request.
 */
const useFriends = () => {
  const [tab, setTabState] = useState("friends");
  const [people, setPeople] = useState({ data: null, loading: true, error: "" });
  const [actingIds, setActingIds] = useState(() => new Set());
  const [rowErrors, setRowErrors] = useState({});
  const errorTimers = useRef({});

  // Note: never calls setState synchronously in its own body — only from
  // the .then/.catch callbacks — so the effect below stays free of the
  // "setState synchronously within an effect" lint violation. Callers that
  // want the loading flag flipped on (tab switch, retry) do it themselves,
  // synchronously, before triggering this.
  const load = useCallback((activeTab, { signal, silent = false } = {}) => {
    return api
      .get(`/friends?tab=${activeTab}`, { signal })
      .then(({ data }) => setPeople({ data: data.data, loading: false, error: "" }))
      .catch((error) => {
        if (error.code === "ERR_CANCELED") return;
        if (silent) return; // a quiet reconcile failing shouldn't blank out a list the user can already see
        setPeople({
          data: null,
          loading: false,
          error: error.response?.data?.error?.message || "Unable to load friends.",
        });
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(tab, { signal: controller.signal });
    return () => controller.abort();
  }, [tab, load]);

  useEffect(
    () => () => Object.values(errorTimers.current).forEach(clearTimeout),
    [],
  );

  // Switches tabs and clears the outgoing tab's list immediately, in the
  // same render, so the skeleton shows right away instead of leaving the
  // previous tab's cards frozen on screen while the new tab loads.
  const setTab = (id) => {
    if (id === tab) return;
    setPeople({ data: null, loading: true, error: "" });
    setTabState(id);
  };

  const reload = () => {
    setPeople((current) => ({ ...current, loading: true, error: "" }));
    load(tab);
  };

  const removeRow = (id) =>
    setPeople((current) => ({
      ...current,
      data: current.data?.filter((entry) => rowId(entry) !== id),
    }));

  const runAction = async (id, task) => {
    if (actingIds.has(id)) return;
    clearTimeout(errorTimers.current[id]);
    setActingIds((current) => new Set(current).add(id));
    setRowErrors((current) => ({ ...current, [id]: "" }));

    try {
      await task();
    } catch (error) {
      const message = error.response?.data?.error?.message || "Something went wrong.";
      setRowErrors((current) => ({ ...current, [id]: message }));
      errorTimers.current[id] = setTimeout(() => {
        setRowErrors((current) => ({ ...current, [id]: "" }));
      }, 4000);
    } finally {
      setActingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  const acceptRequest = (entry) => {
    const id = rowId(entry);
    runAction(id, async () => {
      await api.post(`/friends/requests/${entry.id}/accept`);
      removeRow(id);
      load(tab, { silent: true });
    });
  };

  const cancelRequest = (entry) => {
    const id = rowId(entry);
    runAction(id, async () => {
      await api.delete(`/friends/requests/${entry.user.id}`);
      removeRow(id);
      load(tab, { silent: true });
    });
  };

  return {
    tab,
    setTab,
    people: { ...people, reload },
    actingIds,
    rowErrors,
    acceptRequest,
    cancelRequest,
    runAction,
  };
};

export default useFriends;
