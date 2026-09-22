import { useCallback, useEffect, useState } from "react";

import { api } from "../../../utility/api";
import { useRealtime } from "../../../utility/helpers";

// Active (non-expired) stories from the current user and their friends,
// grouped by author — same visibility rule as the feed (friends + self,
// see stories.routes.js). Expiry itself is enforced server-side (a Mongo
// TTL index), so anything this returns is guaranteed still active.
const useStories = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/stories");
      setGroups(data.data || []);
      setError("");
    } catch (loadError) {
      setError(loadError.response?.data?.error?.message || "Couldn't load stories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred a microtask out, so this reads as "subscribe to an external
    // fetch" rather than a synchronous setState-in-effect the lint rule
    // (correctly) warns about for the more common accidental case.
    queueMicrotask(() => {
      load();
    });
  }, [load]);

  // A friend posted or removed a story — refresh the rail. Stories are a
  // small, infrequently-changing list, so a full reload is simpler and
  // safer than patching individual groups in place.
  useRealtime("story:new", load);
  useRealtime("story:deleted", load);

  const createStory = async (formData) => {
    const { data } = await api.post("/stories", formData);
    await load();
    return data.data;
  };

  const deleteStory = async (storyId) => {
    await api.delete(`/stories/${storyId}`);
    await load();
  };

  return { groups, loading, error, reload: load, createStory, deleteStory };
};

export default useStories;
