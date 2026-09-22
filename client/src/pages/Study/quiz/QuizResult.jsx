import { Check, Close, EmojiEvents, Replay, Star } from "@mui/icons-material";

import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";

/**
 * Shown after a QuizPlayer attempt completes. `result` is the completion
 * payload from the last answer response — score/correct/wrong come from
 * the server, never recomputed client-side, so this can never be spoofed
 * by editing local state.
 */
export default function QuizResult({ result, chapterName, setNumber, onRetry, onBackToSets }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-accent/10 text-accent">
        <EmojiEvents fontSize="large" />
      </div>

      <div>
        <h2 className="font-display text-xl font-bold text-ink">Quiz Complete!</h2>
        <p className="mt-1 text-sm text-muted">
          {chapterName} — Set {setNumber}
        </p>
      </div>

      <Card className="grid w-full grid-cols-3 gap-3">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-muted">Questions</span>
          <span className="text-xl font-bold text-ink">{result.totalQuestions}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="flex items-center gap-1 text-xs text-muted">
            <Check style={{ fontSize: 14 }} className="text-green-600 dark:text-green-400" /> Correct
          </span>
          <span className="text-xl font-bold text-green-600 dark:text-green-400">
            {result.correctCount}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="flex items-center gap-1 text-xs text-muted">
            <Close style={{ fontSize: 14 }} className="text-danger" /> Wrong
          </span>
          <span className="text-xl font-bold text-danger">{result.wrongCount}</span>
        </div>
      </Card>

      <Card className="flex w-full items-center justify-center gap-2 bg-accent/5">
        <Star className="text-accent" />
        <span className="text-2xl font-bold text-ink">Score: {result.score}</span>
      </Card>

      <div
        className={
          result.isFirstAttempt
            ? "w-full rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm font-medium text-accent"
            : "w-full rounded-lg border border-line bg-soft p-3 text-sm font-medium text-muted"
        }
      >
        {result.isFirstAttempt
          ? "🏆 This was your first attempt — your score has been submitted to the leaderboard."
          : "This is a practice attempt — it won't change your leaderboard score."}
      </div>

      <div className="flex w-full gap-2.5">
        <Button variant="outline" className="flex-1" onClick={onBackToSets}>
          Back to Sets
        </Button>
        <Button variant="primary" className="flex-1" onClick={onRetry}>
          <Replay fontSize="small" />
          Try Again
        </Button>
      </div>
    </div>
  );
}
