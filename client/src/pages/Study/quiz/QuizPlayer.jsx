import { Check, Close, QuestionMark, Timer as TimerIcon } from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";

import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { api } from "../../../utility/api";
import { cx } from "../../../utility/cx";

const OPTION_LABELS = ["A", "B", "C", "D"];

// Seconds allowed per question. Change this one constant to retune the
// whole timer (countdown display, warning/danger thresholds below, and the
// auto-submit-on-timeout behavior all derive from it).
const QUESTION_TIME_LIMIT = 15;
const WARNING_AT = 9; // <=9s and >5s: warning state
const DANGER_AT = 5; // <=5s: danger state + one beep per second

function timerState(secondsLeft) {
  if (secondsLeft <= 0) return "timeout";
  if (secondsLeft <= DANGER_AT) return "danger";
  if (secondsLeft <= WARNING_AT) return "warning";
  return "normal";
}

const TIMER_BADGE_CLASSES = {
  normal: "border-line bg-panel text-ink",
  warning: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  danger: "border-danger bg-danger-soft text-danger animate-pulse",
  timeout: "border-danger bg-danger-soft text-danger",
};

const TIMER_BAR_CLASSES = {
  normal: "bg-accent",
  warning: "bg-amber-500",
  danger: "bg-danger",
  timeout: "bg-danger",
};

// Short, quiet "blip" — plain Web Audio API, no external package. Every
// call is wrapped so a browser that blocks/lacks audio never breaks the
// quiz; it just plays silently for that user.
function playBeep(audioContextRef) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioContextRef.current) {
      audioContextRef.current = new Ctx();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.2);
  } catch {
    // Sound is a nice-to-have — never let it break the quiz.
  }
}

/**
 * Renders one attempt question-by-question. `attempt` is the payload from
 * POST /quiz/chapters/:chapterId/sets/:setNumber/start — every question's
 * already-shuffled options up front, but the correct answer only for
 * questions this attempt has already answered (see quiz.routes.js's
 * serializeAttemptForClient). `viewIndex` starts at the attempt's
 * `currentIndex` (the first unanswered question), so resuming lands
 * exactly where the user left off rather than replaying answered ones.
 *
 * Each question also carries a client-only 15s countdown (QUESTION_TIME_LIMIT):
 * it resets whenever `viewIndex` changes, stops the instant an answer is
 * submitted (manually or via timeout), and auto-submits with
 * selectedPosition: null when it reaches 0. The countdown itself is a UX
 * nudge only — scoring, resume, and everything else about the attempt is
 * still fully server-side, unaffected by whatever the browser's clock says.
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
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_TIME_LIMIT);

  // Synchronous guard against a double submit (e.g. the user clicks an
  // option in the same instant the countdown hits 0) — React state updates
  // are async, so `submitting` alone can't be trusted to block a second
  // call that fires before the first re-render lands.
  const submittingRef = useRef(false);
  const audioContextRef = useRef(null);
  // Tracks the last second a beep played per question, so a re-render
  // never re-plays the beep for the same second (and StrictMode's
  // effect double-invoke in dev never double-beeps).
  const lastBeepedSecondRef = useRef(null);

  const total = questions?.length || 0;
  const current = total > 0 ? questions[viewIndex] : undefined;
  const isLast = total > 0 && viewIndex === total - 1;
  const progressPercent = total > 0 ? Math.round((viewIndex / total) * 100) : 0;

  const submitAnswer = async (position) => {
    if (submittingRef.current || !current || current.answered) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const { data } = await api.post(`/quiz/attempts/${attempt.attemptId}/answer`, {
        questionIndex: viewIndex,
        selectedPosition: position,
        timedOut: position === null,
      });
      const result = data.data;

      setQuestions((currentQuestions) =>
        currentQuestions.map((item, index) =>
          index === viewIndex
            ? {
                ...item,
                answered: true,
                selectedPosition: position,
                correct: result.correct,
                correctPosition: result.correctPosition,
                timedOut: position === null,
              }
            : item,
        ),
      );
      setScore(result.score);
      setCorrectCount(result.correctCount);
      setWrongCount(result.wrongCount);
      if (result.isComplete) {
        setCompletionData({
          score: result.score,
          correctCount: result.correctCount,
          wrongCount: result.wrongCount,
          totalQuestions: result.totalQuestions,
          isFirstAttempt: result.isFirstAttempt,
        });
      }
    } catch (submitError) {
      setError(submitError.response?.data?.error?.message || "Couldn't submit your answer.");
    } finally {
      submittingRef.current = false;
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

  // Resets the countdown the instant a new question becomes current —
  // done synchronously during render (comparing a tracked copy of
  // viewIndex, the same pattern AddNameDialog.jsx uses to reset its own
  // state on reopen) rather than in an effect, since resetting state in
  // response to a prop/derived value changing is exactly the case React
  // recommends handling at render time instead of via an effect.
  const [trackedViewIndex, setTrackedViewIndex] = useState(viewIndex);
  if (viewIndex !== trackedViewIndex) {
    setTrackedViewIndex(viewIndex);
    setSecondsLeft(QUESTION_TIME_LIMIT);
  }

  // Ref mutation (not state), so it belongs in an effect rather than the
  // render-time reset above — clears the beep dedup guard for the new
  // question.
  useEffect(() => {
    lastBeepedSecondRef.current = null;
  }, [viewIndex]);

  // Countdown ticking — one interval per unanswered current question,
  // fully cleared (cleanup) the instant the question is answered, a
  // submission is in flight, or this effect re-runs for any reason (new
  // question, StrictMode's dev double-invoke, etc.), so there is never
  // more than one interval ticking at a time.
  useEffect(() => {
    if (!current || current.answered || submitting) return undefined;

    const intervalId = setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [current, submitting]);

  // Warning beeps for the last DANGER_AT seconds (5, 4, 3, 2, 1) — one per
  // second, deduped via lastBeepedSecondRef so it can never double-fire.
  useEffect(() => {
    if (!current || current.answered || submitting) return;
    if (secondsLeft <= 0 || secondsLeft > DANGER_AT) return;
    if (lastBeepedSecondRef.current === secondsLeft) return;

    lastBeepedSecondRef.current = secondsLeft;
    playBeep(audioContextRef);
  }, [secondsLeft, current, submitting]);

  // Timeout auto-submit — fires once when the countdown reaches 0 for the
  // current, still-unanswered question. The actual submission is deferred
  // into a timeout callback (rather than called directly from the effect
  // body) purely so state updates happen from a callback, not synchronously
  // during the effect; submitAnswer's own ref guard is what actually
  // prevents a duplicate submission.
  useEffect(() => {
    if (!current || current.answered || submitting) return undefined;
    if (secondsLeft !== 0) return undefined;

    const timeoutId = setTimeout(() => submitAnswer(null), 0);
    return () => clearTimeout(timeoutId);
    // submitAnswer is a plain function recreated each render, closing over
    // the same viewIndex/current/attempt already covered by the deps
    // below — listing it would just make this effect re-run every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, current, submitting]);

  // Release the AudioContext when the player unmounts. Deliberately reads
  // audioContextRef.current inside the cleanup (not captured at effect
  // setup) because the context is created lazily on first beep, often long
  // after this effect runs on mount — capturing it up front would always
  // be null and never actually close the real context.
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const ctx = audioContextRef.current;
      ctx?.close?.().catch(() => {});
    };
  }, []);

  if (!current) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Preparing your question"
        className="mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-3 py-20 text-center"
      >
        <div className="flex size-12 animate-pulse items-center justify-center rounded-full bg-accent/10 text-accent">
          <QuestionMark fontSize="small" />
        </div>
        <p className="text-sm font-medium text-muted">Preparing your question…</p>
      </div>
    );
  }

  const state = current.answered ? null : timerState(secondsLeft);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      {/* Progress + timer */}
      <div>
        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-muted">
          <span>
            Question {viewIndex + 1} / {total}
          </span>
          <div className="flex items-center gap-2">
            <span>Score: {score}</span>
            {state && (
              <span
                aria-label={`${secondsLeft} seconds remaining`}
                className={cx(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 font-bold tabular-nums transition-colors",
                  TIMER_BADGE_CLASSES[state],
                )}
              >
                <TimerIcon style={{ fontSize: 13 }} />
                {secondsLeft}s
              </span>
            )}
          </div>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-soft">
          <div
            className="h-full rounded-full bg-accent transition-all motion-safe:duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {state && (
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-soft">
            <div
              className={cx("h-full rounded-full transition-all duration-1000 ease-linear", TIMER_BAR_CLASSES[state])}
              style={{ width: `${(secondsLeft / QUESTION_TIME_LIMIT) * 100}%` }}
            />
          </div>
        )}
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
            {current.timedOut && <p className="text-sm font-semibold text-danger">⏱ Time's up!</p>}
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
