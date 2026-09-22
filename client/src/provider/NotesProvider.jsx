import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "../utility/api";
import { useRealtime } from "../utility/helpers";
import { NotesContext } from "../utility/notePresence";
import NoteViewerDialog from "../pages/feed/components/NoteViewerDialog";

/**
 * App-wide active-notes state, mirroring StoriesProvider.jsx exactly (same
 * fetch/realtime/global-viewer shape) — Notes are a second, independent
 * "short-lived thing a friend posted" feed, kept as its own small
 * collection/provider rather than folded into Story to avoid conflating
 * two different content types into one schema.
 */
export function NotesProvider({ children }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewerAuthorId, setViewerAuthorId] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/notes");
      setEntries(data.data || []);
      setError("");
    } catch (loadError) {
      setError(loadError.response?.data?.error?.message || "Couldn't load notes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      load();
    });
  }, [load]);

  useRealtime("note:new", load);
  useRealtime("note:deleted", load);

  const createNote = async (text) => {
    const { data } = await api.post("/notes", { text });
    await load();
    return data.data;
  };

  const deleteNote = async (noteId) => {
    await api.delete(`/notes/${noteId}`);
    await load();
  };

  const viewerEntry = useMemo(
    () => entries.find((entry) => entry.author.id === viewerAuthorId) || null,
    [entries, viewerAuthorId],
  );

  const openViewer = useCallback((authorId) => setViewerAuthorId(authorId), []);
  const closeViewer = useCallback(() => setViewerAuthorId(null), []);

  const value = useMemo(
    () => ({ entries, loading, error, reload: load, createNote, deleteNote, openViewer, closeViewer }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, loading, error, load, openViewer, closeViewer],
  );

  return (
    <NotesContext.Provider value={value}>
      {children}
      {viewerEntry && <NoteViewerDialog entry={viewerEntry} onClose={closeViewer} onDelete={deleteNote} />}
    </NotesContext.Provider>
  );
}
