import { useNotesContext } from "../../../utility/notePresence";

// Thin wrapper over the app-wide NotesProvider (mounted once in
// Shell.jsx), mirroring useStories.js.
const useNotes = () => useNotesContext();

export default useNotes;
