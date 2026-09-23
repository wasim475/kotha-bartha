import { Check, Close } from "@mui/icons-material";
import { useState } from "react";

import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { api } from "../../../utility/api";
import { cx } from "../../../utility/cx";

const OPTION_LABELS = ["A", "B", "C", "D"];

/**
 * Renders one attempt question-by-question. `attempt` is the payload from
 * POST /quiz/chapters/:chapterId/sets/:setNumber/start — every question's
 * already-shuffled options up front, but the correct answer only for
 * questions this attempt has already answered (see quiz.routes.js's
 * serializeAttemptForClient). `viewIndex` starts at the attempt's
 * `currentIndex` (the first unanswered question), so resuming lands
 * exactly where the user left off rather than replaying answered ones.
 */
export default function QuizPlayer({ attempt, onComplete }) {
  const [questions, setQuestions] = useState(attempt.questions);
  const [viewIndex, setViewIndex] = useState(attempt.currentIndex);
  const [score, setScore] = useState(attempt.score);
  const [correctCount, setCorrectCount] = useState(attempt.correctCount);
  const [wrongCount, setWrongCount] = useState(attempt.wrongCount);
  const [submitting, setSubmitting] = useState(false);
  const [completionData, setCompletionData] = useState(null);
  const [error, setError] = useState("");

  const total = questions?.length;
  const current = questions[viewIndex];
  const isLast = viewIndex === total - 1;
  const progressPercent = Math.round((viewIndex / total) * 100);

  const submitAnswer = async (position) => {
    if (submitting || current.answered) return;
    setSubmitting(true);
    setError("");
    try {
      const { data } = await api.post(`/quiz/attempts/${attempt.attemptId}/answer`, {
        questionIndex: viewIndex,
        selectedPosition: position,
      });

      setQuestions((currentQuestions) =>
        currentQuestions.map((item, index) =>
          index === viewIndex
            ? {
                ...item,
                answered: true,
                selectedPosition: position,
                correct: data.correct,
                correctPosition: data.correctPosition,
              }
            : item,
        ),
      );
      setScore(data.score);
      setCorrectCount(data.correctCount);
      setWrongCount(data.wrongCount);
      if (data.isComplete) {
        setCompletionData({
          score: data.score,
          correctCount: data.correctCount,
          wrongCount: data.wrongCount,
          totalQuestions: data.totalQuestions,
          isFirstAttempt: data.isFirstAttempt,
        });
      }
    } catch (submitError) {
      setError(submitError.response?.data?.error?.message || "Couldn't submit your answer.");
    } finally {
      setSubmitting(false);
    }
  };

  const advance = () => {
    if (isLast) {
      onComplete(completionData);
      return;
    }
    setViewIndex((index) => index + 1);
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-muted">
          <span>
            Question {viewIndex + 1} / {total}
          </span>
          <span>Score: {score}</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-soft">
          <div
            className="h-full rounded-full bg-accent transition-all motion-safe:duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <Check style={{ fontSize: 13 }} /> {correctCount}
          </span>
          <span className="flex items-center gap-1 text-danger">
            <Close style={{ fontSize: 13 }} /> {wrongCount}
          </span>
        </div>
      </div>

      <Card className="flex flex-col gap-4">
        <p className="text-base leading-relaxed font-semibold text-ink sm:text-lg">
          {current.question}
        </p>

        <div className="grid gap-2.5">
          {current.options.map((optionText, position) => {
            const isSelected = current.selectedPosition === position;
            const isCorrectOption = current.answered && current.correctPosition === position;
            const isWrongSelected = current.answered && isSelected && !current.correct;

            return (
              <button
                key={position}
                type="button"
                disabled={current.answered || submitting}
                onClick={() => submitAnswer(position)}
                className={cx(
                  "flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-colors motion-safe:duration-150",
                  "disabled:cursor-not-allowed",
                  !current.answered && "border-line bg-panel hover:border-accent hover:bg-soft",
                  isCorrectOption && "border-green-500 bg-green-500/10 text-green-700 dark:text-green-300",
                  isWrongSelected && "border-danger bg-danger-soft text-danger",
                  current.answered && !isCorrectOption && !isWrongSelected && "border-line bg-panel opacity-60",
                )}
              >
                <span
                  className={cx(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                    isCorrectOption
                      ? "border-green-500 bg-green-500 text-white"
                      : isWrongSelected
                        ? "border-danger bg-danger text-white"
                        : "border-line text-muted",
                  )}
                >
                  {OPTION_LABELS[position]}
                </span>
                <span className="min-w-0 flex-1 wrap-anywhere">{optionText}</span>
                {isCorrectOption && <Check fontSize="small" className="shrink-0 text-green-600 dark:text-green-400" />}
                {isWrongSelected && <Close fontSize="small" className="shrink-0 text-danger" />}
              </button>
            );
          })}
        </div>

        {error && <p className="text-xs font-medium text-danger">{error}</p>}

        {current.answered && (
          <div className="flex flex-col gap-2.5 border-t border-line pt-4">
            <p
              className={cx(
                "text-sm font-semibold",
                current.correct ? "text-green-600 dark:text-green-400" : "text-danger",
              )}
            >
              {current.correct ? "Correct! +1" : "Wrong answer. −1"}
            </p>
            {!current.correct && (
              <p className="text-xs text-muted">
                Correct answer:{" "}
                <span className="font-semibold text-ink">
                  {current.options[current.correctPosition]}
                </span>
              </p>
            )}
            <Button variant="primary" onClick={advance}>
              {isLast ? "See Results" : "Next Question"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
