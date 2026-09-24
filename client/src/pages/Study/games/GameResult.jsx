import { FactCheck, Replay } from "@mui/icons-material";
import { motion as Motion } from "framer-motion";

import Button from "../../../components/ui/Button";
import useButtonColorFix from "../../../utility/useButtonColorFix";
import GameResultCard from "./components/GameResultCard";
import { resultHeadline } from "./utility/gameTypes";

/**
 * End-of-game screen. Reusable for any game type — it only needs the final
 * numbers (from the server's last answer response) and a few callbacks.
 * "Review Mistakes" opens the last-game review for this attempt.
 */
export default function GameResult({ result, gameName, motionVariants, onPlayAgain, onBack, onReview }) {
  const primaryFix = useButtonColorFix("primary");
  const outlineFix = useButtonColorFix("outline");
  const mistakes = result.wrongCount;

  return (
    <Motion.div
      className="mx-auto flex w-full max-w-md flex-col items-center gap-5 text-center"
      variants={motionVariants.resultContainer}
      initial="hidden"
      animate="show"
    >
      <Motion.div variants={motionVariants.resultItem} className="flex flex-col items-center gap-1.5">
        <span className="text-5xl" role="img" aria-label="Celebration">
          🎉
        </span>
        <h1 className="font-display text-2xl font-semibold text-ink">Game Complete!</h1>
        <p className="text-sm text-muted">
          {gameName} · {resultHeadline(result.accuracy)}
        </p>
      </Motion.div>

      <div className="w-full">
        <GameResultCard
          score={result.score}
          total={result.totalQuestions}
          correctCount={result.correctCount}
          wrongCount={result.wrongCount}
          timeoutCount={result.timeoutCount}
          accuracy={result.accuracy}
          itemVariants={motionVariants.resultItem}
        />
      </div>

      <Motion.div variants={motionVariants.resultItem} className="flex w-full flex-col gap-2.5">
        {mistakes > 0 ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={onReview}
            style={outlineFix.style}
            onMouseEnter={outlineFix.onMouseEnter}
            onMouseLeave={outlineFix.onMouseLeave}
          >
            <FactCheck fontSize="small" />
            Review Mistakes ({mistakes})
          </Button>
        ) : (
          <p className="rounded-xl border border-line bg-soft px-3 py-2.5 text-xs font-semibold text-muted">
            Perfect game — no mistakes to review.
          </p>
        )}

        <div className="flex w-full gap-2.5">
          <Button
            variant="outline"
            className="min-w-0 flex-1"
            onClick={onBack}
            style={outlineFix.style}
            onMouseEnter={outlineFix.onMouseEnter}
            onMouseLeave={outlineFix.onMouseLeave}
          >
            Back to Games
          </Button>
          <Button
            variant="primary"
            className="min-w-0 flex-1"
            onClick={onPlayAgain}
            autoFocus
            style={primaryFix.style}
            onMouseEnter={primaryFix.onMouseEnter}
            onMouseLeave={primaryFix.onMouseLeave}
          >
            <Replay fontSize="small" />
            Play Again
          </Button>
        </div>
      </Motion.div>
    </Motion.div>
  );
}
