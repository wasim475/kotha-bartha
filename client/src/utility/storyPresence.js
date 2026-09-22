import { createContext, useContext } from "react";

// Split out from provider/StoriesProvider.jsx (which also renders the
// global StoryViewerDialog, which itself renders Avatar) specifically so
// Avatar.jsx can read "does this person have an active story" without
// creating an import cycle: Avatar -> StoriesProvider -> StoryViewerDialog
// -> Avatar. This file has no component/dialog dependencies at all.
export const StoriesContext = createContext(null);
const EMPTY_SET = new Set();

// Safe to call even where the provider isn't mounted — always returns a
// Set, never throws.
export function useActiveStoryAuthorIds() {
  return useContext(StoriesContext)?.activeStoryAuthorIds || EMPTY_SET;
}

export function useStoriesContext() {
  return useContext(StoriesContext);
}
