import { motion as Motion, useReducedMotion } from "framer-motion";
import { forwardRef, useEffect, useRef } from "react";

import { cx } from "../../../utility/cx";
import ReactionIcon from "./ReactionIcons";
import { REACTION_LABELS, REACTION_TYPES } from "./reactionTypes";

/**
 * The floating row of five reaction faces. Purely presentational —
 * positioning, open/close state and outside-click handling live in
 * `ReactionButton`, which is the only place this should be mounted from.
 * Forwards its ref to the underlying motion.div so the caller can measure
 * it for viewport clamping.
 *
 * `autoFocus` moves keyboard focus onto the selected (or first) reaction
 * when the picker was opened via the keyboard (ArrowDown on the trigger),
 * so keyboard-only users can actually reach every reaction, not just the
 * quick-like default.
 */
const ReactionPicker = forwardRef(function ReactionPicker(
  {
    selected,
    onSelect,
    types = REACTION_TYPES,
    className = "",
    autoFocus = false,
    placement = "top",
  },
  forwardedRef,
) {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef(null);
  // Slide in from the side the picker is anchored to, not always upward —
  // it reads oddly for a picker sitting below its trigger to animate as if
  // it were still opening from above.
  const travel = placement === "bottom" ? -8 : 8;

  const setRefs = (node) => {
    containerRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  useEffect(() => {
    if (!autoFocus) return;
    const target =
      containerRef.current?.querySelector(
        selected ? `[data-reaction-type="${selected}"]` : "[data-reaction-type]",
      );
    target?.focus();
    // Only ever run once, on mount — this picker instance is remounted
    // fresh each time it opens (via AnimatePresence in ReactionButton).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Motion.div
      ref={setRefs}
      role="menu"
      aria-label="Pick a reaction"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.85, y: travel }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: travel * 0.75 }}
      transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}
      className={cx(
        "flex items-center gap-1 rounded-full border border-line bg-panel p-1.5 shadow-soft",
        className,
      )}
    >
      {types.map((type) => (
        <button
          key={type}
          type="button"
          data-reaction-type={type}
          role="menuitemradio"
          aria-checked={selected === type}
          aria-label={REACTION_LABELS[type]}
          title={REACTION_LABELS[type]}
          onClick={() => onSelect(type)}
          className={cx(
            "flex size-9 items-center justify-center rounded-full p-1.5",
            "transition-transform motion-safe:duration-150 motion-safe:hover:-translate-y-1 motion-safe:hover:scale-125 motion-safe:focus-visible:scale-125",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            selected === type && "bg-soft",
          )}
        >
          <ReactionIcon type={type} className="size-full" />
        </button>
      ))}
    </Motion.div>
  );
});

export default ReactionPicker;
