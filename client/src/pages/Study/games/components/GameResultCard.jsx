import { motion as Motion } from "framer-motion";

function Tile({ label, value, kind }) {
  return (
    <div className="game-result-tile" data-kind={kind}>
      <span className="text-[11px] font-bold tracking-wide text-muted uppercase">{label}</span>
      <span className="game-result-tile-value">{value}</span>
    </div>
  );
}

/** Score, correct, wrong and accuracy — every number comes from the server's final response. */
export default function GameResultCard({ score, total, correctCount, wrongCount, accuracy, itemVariants }) {
  return (
    <Motion.div variants={itemVariants} className="flex flex-col gap-3">
      <div className="game-result-score">
        <span className="text-[11px] font-bold tracking-wide text-muted uppercase">Score</span>
        <span className="font-display text-5xl font-semibold text-ink tabular-nums">
          {score} <span className="text-3xl text-muted">/ {total}</span>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Tile label="Correct" value={correctCount} kind="correct" />
        <Tile label="Wrong" value={wrongCount} kind="wrong" />
        <Tile label="Accuracy" value={`${accuracy}%`} />
      </div>
    </Motion.div>
  );
}
