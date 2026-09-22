import { createContext, useContext } from "react";

// Split out from provider/NotesProvider.jsx for the same reason
// storyPresence.js is split from StoriesProvider.jsx — keeps the
// provider file exporting only its component (react-refresh's
// only-export-components rule) and gives any consumer a context import
// with no dialog/component dependencies.
export const NotesContext = createContext(null);

export function useNotesContext() {
  return useContext(NotesContext);
}
