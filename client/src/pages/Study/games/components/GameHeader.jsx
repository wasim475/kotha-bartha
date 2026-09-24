import { motion as Motion } from "framer-motion";

function Stat({ label, value, kind, pop }) {
  return (
    <div className="game-stat" data-kind={kind}>
      <span className="game-stat-label">{label}</span>
      {/* Keyed on the value so it re-mounts (and pops) whenever it changes. */}
      <Motion.span key={value} className="game-stat-value" initial={pop.initial} animate={pop.animate}>
        {value}
      </Motion.span>
    </div>
  );
}

/**
 * Game name, "Question X / N", the live score / correct / wrong counts, and —
 * for timed games — the countdown (`timer`). Stays readable on a 320px
 * screen: the title row truncates, the timer keeps a fixed size at its right,
 * and the three stats sit in an equal-width grid underneath.
 */
export default function GameHeader({
  name,
  icon,
  questionNumber,
  total,
  score,
  correctCount,
  wrongCount,
  pop,
  timer,
}) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="game-tile game-tile--sm" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg leading-tight font-semibold text-ink">{name}</h1>
          <p className="text-xs font-semibold text-muted">
            Question {questionNumber} / {total}
          </p>
        </div>
        {timer}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Score" value={score} pop={pop} />
        <Stat label="Correct" value={correctCount} kind="correct" pop={pop} />
        <Stat label="Wrong" value={wrongCount} kind="wrong" pop={pop} />
      </div>
    </header>
  );
}
