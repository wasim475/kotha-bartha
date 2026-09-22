import { useEffect, useMemo, useState } from "react";
import { api } from "../../../utility/api";

const DEBOUNCE_MS = 300;

// Server-side regex search for plaintext (group, or non-E2E 1-to-1)
// conversations; for an E2E-encrypted 1-to-1 conversation the server can't
// search ciphertext, so this filters the thread that's already fully
// loaded and locally decrypted — no extra fetching either way.
const useMessageSearch = ({ conversationId, selected, thread }) => {
  const [query, setQuery] = useState("");
  const [serverResults, setServerResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const trimmed = query.trim();
  const useClientSearch = !selected?.isGroup && Boolean(selected?.user?.publicKeys?.length);

  const clientResults = useMemo(() => {
    if (!useClientSearch || !trimmed) return [];
    const lower = trimmed.toLowerCase();
    return (thread.data || [])
      .filter((message) => !message.encrypted || message._decryptState === "ok")
      .filter((message) => message.body?.toLowerCase().includes(lower))
      .slice(-30)
      .reverse();
  }, [useClientSearch, trimmed, thread.data]);

  useEffect(() => {
    if (useClientSearch || !trimmed || !conversationId) return undefined;

    let cancelled = false;
    const timer = setTimeout(() => {
      (async () => {
        setLoading(true);
        setError("");
        try {
          const { data } = await api.get(`/conversations/${conversationId}/messages/search`, {
            params: { q: trimmed },
          });
          if (!cancelled) setServerResults(data.data || []);
        } catch (searchError) {
          if (!cancelled)
            setError(searchError.response?.data?.error?.message || "Search failed.");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, conversationId, useClientSearch]);

  return {
    query,
    setQuery,
    results: useClientSearch ? clientResults : trimmed ? serverResults : [],
    loading: useClientSearch ? false : loading,
    error: useClientSearch ? "" : error,
  };
};

export default useMessageSearch;
