import { Check, Close } from "@mui/icons-material";
import { motion as Motion } from "framer-motion";

import { cx } from "../../../../utility/cx";
import { ANSWER_STATE } from "../utility/gameTypes";

const LONG_PROMPT_CHARS = 22;

/**
 * The question card: result badge, the prompt, and its options (children).
 * `state` drives both the CSS color state (data-state → green / red glow) and
 * the framer-motion variant (pop / shake / fade-out) — see useGameAnimation.
 * Keyed by question index by the caller, so every new question re-mounts and
 * plays the entrance animation.
 */
export default function GameQuestion({ prompt, state, motionVariants, children }) {
  const isResult = state === ANSWER_STATE.CORRECT || state === ANSWER_STATE.WRONG;
  const indicatorState = isResult ? state : "hidden";

  return (
    <Motion.section
      className="game-card"
      data-state={state}
      variants={motionVariants.card}
      initial="initial"
      animate={state}
    >
      <div className="game-indicator-slot">
        <Motion.span
          className="game-indicator"
          data-kind={isResult ? state : undefined}
          variants={motionVariants.indicator}
          initial="hidden"
          animate={indicatorState}
          aria-hidden={!isResult}
        >
          {state === ANSWER_STATE.WRONG ? <Close fontSize="small" /> : <Check fontSize="small" />}
          {state === ANSWER_STATE.WRONG ? "Not quite" : "Correct!"}
        </Motion.span>
      </div>

      <p className={cx("game-question", prompt.length > LONG_PROMPT_CHARS && "game-question--long")}>{prompt}</p>

      {children}

      {/* Announced by screen readers; the colors alone never carry the result. */}
      <p className="sr-only" role="status" aria-live="polite">
        {state === ANSWER_STATE.CORRECT ? "Correct" : state === ANSWER_STATE.WRONG ? "Wrong" : ""}
      </p>
    </Motion.section>
  );
}
