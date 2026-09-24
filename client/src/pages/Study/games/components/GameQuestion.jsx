import { AccessTime, Check, Close } from "@mui/icons-material";
import { motion as Motion } from "framer-motion";

import { cx } from "../../../../utility/cx";
import { ANSWER_STATE } from "../utility/gameTypes";

const LONG_PROMPT_CHARS = 22;

/**
 * The question card: result badge, the prompt, and its options (children).
 * `state` drives both the CSS color state (data-state → green / red glow) and
 * the framer-motion variant (pop / shake / fade-out) — see useGameAnimation.
 * A timed-out question uses the very same red state as a wrong answer; only
 * the badge wording differs (`timedOut`). Keyed by question number by the
 * caller, so every new question re-mounts and plays the entrance animation.
 */
export default function GameQuestion({ prompt, state, timedOut = false, motionVariants, children }) {
  const isResult = state === ANSWER_STATE.CORRECT || state === ANSWER_STATE.WRONG;
  const indicatorState = isResult ? state : "hidden";
  const isWrong = state === ANSWER_STATE.WRONG;

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
          {isWrong ? timedOut ? <AccessTime fontSize="small" /> : <Close fontSize="small" /> : <Check fontSize="small" />}
          {isWrong ? (timedOut ? "Time's up!" : "Not quite") : "Correct!"}
        </Motion.span>
      </div>

      <p className={cx("game-question", prompt.length > LONG_PROMPT_CHARS && "game-question--long")}>{prompt}</p>

      {children}

      {/* Announced by screen readers; the colors alone never carry the result. */}
      <p className="sr-only" role="status" aria-live="polite">
        {state === ANSWER_STATE.CORRECT ? "Correct" : isWrong ? (timedOut ? "Time's up" : "Wrong") : ""}
      </p>
    </Motion.section>
  );
}
