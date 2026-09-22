import { useStoriesContext } from "../../../utility/storyPresence";

// Thin wrapper over the app-wide StoriesProvider (mounted once in
// Shell.jsx) — kept as its own hook so StoryRail.jsx and any other
// consumer don't need to know the state actually lives in a context.
const useStories = () => useStoriesContext();

export default useStories;
