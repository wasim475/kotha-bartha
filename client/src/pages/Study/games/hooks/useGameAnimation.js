import { useReducedMotion } from "framer-motion";
import { useMemo } from "react";

import { ANSWER_STATE, RESULT_HOLD_MS, TRANSITION_MS } from "../utility/gameTypes";

// The one source of every game animation, keyed by the answer-state names in
// gameTypes.js — components pass their current state to `animate` and never
// define their own keyframes. With "reduce motion" enabled the movement
// (pop / shake / slide) is dropped and only the color states remain.
export default function useGameAnimation() {
  const reduced = useReducedMotion();

  return useMemo(
    () => ({
      holdMs: RESULT_HOLD_MS,
      transitionMs: TRANSITION_MS,

      // The question card. `initial` is the entrance for each new question.
      card: {
        initial: { opacity: 0, y: reduced ? 0 : 14, scale: reduced ? 1 : 0.985, x: 0 },
        [ANSWER_STATE.PLAYING]: {
          opacity: 1,
          y: 0,
          x: 0,
          scale: 1,
          transition: { duration: 0.22, ease: "easeOut" },
        },
        // Subtle success pop.
        [ANSWER_STATE.CORRECT]: {
          opacity: 1,
          y: 0,
          x: 0,
          scale: reduced ? 1 : [1, 1.022, 1],
          transition: { duration: 0.45, ease: "easeOut" },
        },
        // Short, tight shake (stays within the page gutter on small phones).
        [ANSWER_STATE.WRONG]: {
          opacity: 1,
          y: 0,
          scale: 1,
          x: reduced ? 0 : [0, -9, 9, -7, 7, -3, 0],
          transition: { duration: 0.45, ease: "easeInOut" },
        },
        [ANSWER_STATE.TRANSITIONING]: {
          opacity: 0,
          y: reduced ? 0 : -8,
          x: 0,
          scale: 1,
          transition: { duration: TRANSITION_MS / 1000, ease: "easeIn" },
        },
      },

      // The check / cross badge above the question.
      indicator: {
        hidden: { opacity: 0, scale: reduced ? 1 : 0.6 },
        [ANSWER_STATE.CORRECT]: {
          opacity: 1,
          scale: reduced ? 1 : [0.6, 1.12, 1],
          transition: { duration: 0.34, ease: "easeOut" },
        },
        [ANSWER_STATE.WRONG]: {
          opacity: 1,
          scale: reduced ? 1 : [0.6, 1.08, 1],
          transition: { duration: 0.3, ease: "easeOut" },
        },
      },

      // Tap feedback for an option that can still be chosen.
      optionTap: reduced ? undefined : { scale: 0.97 },

      // Small pop when a stat number changes.
      statPop: {
        initial: { scale: reduced ? 1 : 1.35, opacity: 0.6 },
        animate: { scale: 1, opacity: 1, transition: { duration: 0.25, ease: "easeOut" } },
      },

      // Staggered entrance for the result screen.
      resultContainer: {
        hidden: {},
        show: { transition: { staggerChildren: reduced ? 0 : 0.08 } },
      },
      resultItem: {
        hidden: { opacity: 0, y: reduced ? 0 : 12 },
        show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: "easeOut" } },
      },
    }),
    [reduced],
  );
}
