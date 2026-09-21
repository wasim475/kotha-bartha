import { ArrowUpward } from "@mui/icons-material";
import { AnimatePresence, motion as Motion, useReducedMotion } from "framer-motion";

/**
 * Sticky "N new posts" pill. Only rendered while there's something to show
 * — clicking it hands off to the caller (loadNewPosts) which merges the
 * new posts in and clears the count.
 */
export default function NewPostsIndicator({ count, onClick }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="sticky top-[68px] z-[3] flex justify-center sm:top-20" aria-live="polite">
      <AnimatePresence>
        {count > 0 && (
          <Motion.button
            type="button"
            onClick={onClick}
            initial={reduceMotion ? false : { opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-bold text-white shadow-soft transition-colors hover:bg-accent-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ArrowUpward fontSize="inherit" />
            {count === 1 ? "1 new post" : `${count} new posts`}
          </Motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
