import { Check, Close } from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";

import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { api } from "../../../utility/api";
import { cx } from "../../../utility/cx";
import { playCorrectAnswerSound, playCountdownBeep, playWrongAnswerSound } from "../../../utility/sound";
import QuizLoader from "./QuizLoader";

const OPTION_LABELS = ["A", "B", "C", "D"];

// Seconds allowed per question. Change this one constant to retune the
// whole timer (countdown display, warning/danger thresholds below, and the
// auto-submit-on-timeout behavior all derive from it).
const QUESTION_TIME_LIMIT = 30;
const WARNING_AT = 10; // <=10s and >5s: warning state
const DANGER_AT = 5; // <=5s: danger state
// Seconds-remaining marks at which a short beep plays, once each per
// question.
const BEEP_AT_SECONDS = [10, 5];

function timerState(secondsLeft) {
  if (secondsLeft <= 0) return "timeout";
  if (secondsLeft <= DANGER_AT) return "danger";
  if (secondsLeft <= WARNING_AT) return "warning";
  return "normal";
}

const TIMER_RING_CLASSES = {
  normal: "stroke-accent",
  warning: "stroke-amber-500",
  danger: "stroke-danger",
  timeout: "stroke-danger",
};

const TIMER_TEXT_CLASSES = {
  normal: "text-ink",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-danger",
  timeout: "text-danger",
};

// A large, fixed-size circular countdown. The remaining seconds are always
// shown as a bold, tabular-nums number in the center — the ring color is a
// secondary cue, never the only signal — and the circle's footprint never
// changes size as the number goes from 2 digits to 1, so there's no layout
// shift between e.g. "10" and "9".
function CircularTimer({ secondsLeft, state }) {
  const size = 64;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, secondsLeft / QUESTION_TIME_LIMIT));
  const dashOffset = circumference * (1 - progress);

  return (
    <div
      role="timer"
      aria-label={`${secondsLeft} seconds remaining`}
      className={cx("relative shrink-0", state === "danger" && "motion-safe:animate-pulse")}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-soft" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={cx("transition-[stroke-dashoffset] duration-1000 ease-linear", TIMER_RING_CLASSES[state])}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cx("text-xl leading-none font-extrabold tabular-nums", TIMER_TEXT_CLASSES[state])}>
          {secondsLeft}
        </span>
      </div>
    </div>
  );
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
 * Each question also carries a client-only QUESTION_TIME_LIMIT (30s)
 * countdown: it resets whenever `viewIndex` changes, stops the instant an
 * answer is submitted (manually or via timeout), and auto-submits with
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
  // Which of BEEP_AT_SECONDS have already beeped for the current question
  // — guards each mark to fire exactly once, even across React
  // re-renders/StrictMode's dev double-invoke.
  const beepedThresholdsRef = useRef(new Set());
  // The single source of truth for this question's countdown — a fixed
  // wall-clock timestamp, not a counter. Every tick re-derives secondsLeft
  // from `Math.ceil((deadline - Date.now()) / 1000)` instead of
  // decrementing a running value, so the display, the beep marks, and the
  // timeout can never drift apart from each other or from real elapsed
  // time (which a plain `setInterval(fn, 1000)` decrement is prone to —
  // that's what previously caused the 10s cue to fire anywhere from 7-9s).
  // Set to a real deadline in the viewIndex effect below, not here —
  // Date.now() is an impure call and can't run in render.
  const deadlineRef = useRef(null);
  // The previous tick's secondsLeft, used only to detect the moment the
  // countdown crosses each beep threshold (see the beep effect).
  const previousSecondsRef = useRef(QUESTION_TIME_LIMIT);

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
      // Played exactly once here, driven by the server's own verdict —
      // never by an effect watching state, so a re-render can't repeat it.
      if (result.correct) {
        playCorrectAnswerSound();
      } else {
        playWrongAnswerSound();
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

  // New question: set a fresh 30s deadline and clear the beep dedup guard.
  // Also covers the very first question (this effect runs on mount, same
  // as every later viewIndex change).
  useEffect(() => {
    deadlineRef.current = Date.now() + QUESTION_TIME_LIMIT * 1000;
    previousSecondsRef.current = QUESTION_TIME_LIMIT;
    beepedThresholdsRef.current = new Set();
  }, [viewIndex]);

  // Countdown ticking. Each tick re-derives secondsLeft from
  // deadlineRef/Date.now() rather than decrementing a counter, so it's
  // immune to setInterval's cumulative drift — the exact bug that used to
  // make the countdown cues fire anywhere from 7-9 seconds instead of
  // exactly on the mark. Polls at 250ms (well under 1s) so no whole
  // second, including 10, 5, and 0, is ever skipped under normal
  // conditions. One interval per unanswered current question, fully
  // cleared the instant it's answered, a submission is in flight, or this
  // effect re-runs for any reason (new question, StrictMode's dev
  // double-invoke, etc.) — never more than one at a time.
  useEffect(() => {
    if (!current || current.answered || submitting) return undefined;

    const intervalId = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setSecondsLeft((value) => (value === remaining ? value : remaining));
    }, 250);

    return () => clearInterval(intervalId);
  }, [current, submitting]);

  // Countdown beep — plays once each time the countdown crosses down to a
  // BEEP_AT_SECONDS mark (10s and 5s left), detected via the
  // previous-vs-current transition rather than a single equality check, so
  // a rare skipped tick under heavy throttling still fires it instead of
  // missing it entirely. beepedThresholdsRef guards each mark so it can
  // never replay on a later re-render.
  useEffect(() => {
    const previous = previousSecondsRef.current;
    previousSecondsRef.current = secondsLeft;

    if (!current || current.answered || submitting) return;

    for (const threshold of BEEP_AT_SECONDS) {
      if (beepedThresholdsRef.current.has(threshold)) continue;
      if (previous > threshold && secondsLeft <= threshold && secondsLeft > 0) {
        beepedThresholdsRef.current.add(threshold);
        playCountdownBeep();
      }
    }
  }, [secondsLeft, current, submitting]);

  // Timeout auto-submit — fires once when the deadline-derived countdown
  // reaches 0 for the current, still-unanswered question (secondsLeft
  // clamps at 0 and stays there once the deadline passes, so this can't be
  // skipped by a tick). The actual submission is deferred into a timeout
  // callback (rather than called directly from the effect body) purely so
  // state updates happen from a callback, not synchronously during the
  // effect; submitAnswer's own ref guard is what actually prevents a
  // duplicate submission.
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

  if (!current) {
    return <QuizLoader label="Preparing your question…" />;
  }

  const state = current.answered ? null : timerState(secondsLeft);
  // Persists once the question is answered — green/red glow around the
  // whole card until the user moves on, independent of the live timer
  // state above (which stops mattering the moment it's answered).
  const resultState = current.answered ? (current.correct ? "correct" : "wrong") : null;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      {/* Progress + timer */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted">
              Question {viewIndex + 1} / {total}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">Score: {score}</p>
          </div>
          {state && <CircularTimer secondsLeft={secondsLeft} state={state} />}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-soft">
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

      {/*
        Uses `ring` (box-shadow based) rather than `border-*` for the
        correct/wrong glow — Card's own base classes already set
        `border border-line` (see components/ui/Card.jsx), and appending a
        conditional `border-green-500`/`border-danger` after it competed
        for the same border-color property and lost, which is why the glow
        previously never actually appeared. `ring`/`shadow` are a distinct
        box-shadow layer, so they can't be overridden by Card's own border.
      */}
      <Card
        className={cx(
          "flex flex-col gap-4 transition-shadow motion-safe:duration-300",
          resultState === "correct" && "ring-2 ring-green-500/70 shadow-lg shadow-green-500/30",
          resultState === "wrong" && "ring-2 ring-danger/70 shadow-lg shadow-danger/30",
        )}
      >
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
