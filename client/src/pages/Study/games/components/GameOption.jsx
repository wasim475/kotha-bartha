import { Check, Close } from "@mui/icons-material";
import { motion as Motion } from "framer-motion";

/**
 * One answer choice. `state` is one of:
 *   idle    — selectable
 *   pending — just tapped, waiting for the server's verdict
 *   correct — the right answer (green)
 *   wrong   — the chosen wrong answer (red)
 *   dimmed  — every other option once a result is showing
 */
export default function GameOption({ letter, label, state, disabled, onSelect, tap }) {
  return (
    <Motion.button
      type="button"
      className="game-option"
      data-state={state}
      disabled={disabled}
      onClick={onSelect}
      whileTap={disabled ? undefined : tap}
      aria-label={`Option ${letter}: ${label}`}
    >
      <span className="game-option-key" aria-hidden="true">
        {letter}
      </span>
      <span className="game-option-text">{label}</span>
      {(state === "correct" || state === "wrong") && (
        <span className="game-option-mark" aria-hidden="true">
          {state === "correct" ? <Check fontSize="small" /> : <Close fontSize="small" />}
        </span>
      )}
    </Motion.button>
  );
}
