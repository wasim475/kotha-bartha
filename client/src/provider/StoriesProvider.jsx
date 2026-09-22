import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "../utility/api";
import { useRealtime } from "../utility/helpers";
import { StoriesContext } from "../utility/storyPresence";
import StoryViewerDialog from "../pages/feed/components/StoryViewerDialog";

/**
 * App-wide active-stories state (mounted once in Shell.jsx, above every
 * route) plus a globally-reachable story viewer. Centralizing this here —
 * rather than fetching separately inside StoryRail — is what lets any
 * avatar anywhere (Feed, Comments, Friends, Profile...) show the blue
 * "has an active story" ring and open the same viewer, without each of
 * those components re-fetching /stories or re-implementing the ring.
 */
export function StoriesProvider({ currentUserId, children }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewerAuthorId, setViewerAuthorId] = useState(null);

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
    queueMicrotask(() => {
      load();
    });
  }, [load]);

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

  const activeStoryAuthorIds = useMemo(
    () => new Set(groups.map((group) => group.author.id)),
    [groups],
  );

  const viewerGroupIndex = useMemo(
    () => groups.findIndex((group) => group.author.id === viewerAuthorId),
    [groups, viewerAuthorId],
  );

  const openViewer = useCallback((authorId) => setViewerAuthorId(authorId), []);
  const closeViewer = useCallback(() => setViewerAuthorId(null), []);

  const value = useMemo(
    () => ({
      groups,
      loading,
      error,
      reload: load,
      createStory,
      deleteStory,
      activeStoryAuthorIds,
      openViewer,
      closeViewer,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, loading, error, load, activeStoryAuthorIds, openViewer, closeViewer],
  );

  return (
    <StoriesContext.Provider value={value}>
      {children}
      {viewerGroupIndex !== -1 && (
        <StoryViewerDialog
          groups={groups}
          startIndex={viewerGroupIndex}
          currentUserId={currentUserId}
          onClose={closeViewer}
          onDelete={deleteStory}
        />
      )}
    </StoriesContext.Provider>
  );
}

