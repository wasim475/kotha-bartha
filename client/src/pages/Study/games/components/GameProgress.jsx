import { motion as Motion } from "framer-motion";

/** Progress bar — `answered` of `total` questions done. Updates the moment an answer lands. */
export default function GameProgress({ answered, total, percent }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs font-semibold text-muted">
        <span>Progress</span>
        <span className="tabular-nums">{percent}%</span>
      </div>
      <div
        className="game-progress-track"
        role="progressbar"
        aria-label="Game progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={answered}
        aria-valuetext={`${answered} of ${total} questions answered`}
      >
        <Motion.div
          className="game-progress-fill"
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
