import { timerTone } from "../utility/gameTypes";

const SIZE = 56;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The per-question countdown ring. Purely presentational — it draws whatever
 * `secondsLeft` / `remainingMs` it is given; whether an answer was actually in
 * time is decided by the server, never by this.
 *
 * Fixed size in every state (only colour and the number change), so it can
 * never push the header or the question around. The ring drains smoothly,
 * turns amber at 5s and red at 3s (with a gentle pulse), and dims while
 * stopped (an answer is in / a result is showing).
 */
export default function GameTimer({ secondsLeft, remainingMs, limitSec, running }) {
  const fraction = limitSec ? Math.max(0, Math.min(1, remainingMs / (limitSec * 1000))) : 0;
  const tone = timerTone(secondsLeft);

  return (
    <div
      className="game-timer"
      data-tone={tone}
      data-running={running ? "true" : "false"}
      role="timer"
      aria-label={`${secondsLeft} seconds remaining`}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle className="game-timer-track" cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} strokeWidth={STROKE} />
        <circle
          className="game-timer-progress"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
        />
      </svg>
      <span className="game-timer-value">{secondsLeft}</span>
    </div>
  );
}
