import { Check, Close } from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";

import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { api } from "../../../utility/api";
import { cx } from "../../../utility/cx";
import {
  playCorrectAnswerSound,
  playTenSecondWarningSound,
  playWrongAnswerSound,
  stopSound,
} from "../../../utility/sound";
import QuizLoader from "./QuizLoader";

const OPTION_LABELS = ["A", "B", "C", "D"];

// Seconds allowed per question. Change this one constant to retune the
// whole timer (countdown display, warning/danger thresholds below, and the
// auto-submit-on-timeout behavior all derive from it).
const QUESTION_TIME_LIMIT = 30;
const WARNING_AT = 10; // <=10s and >5s: warning state
const DANGER_AT = 5; // <=5s: danger state
const TEN_SECOND_WARNING_AT = 10; // when the 10s-left sound plays, once

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
  // option in the same instant the countdown hits 0, or while the 10s
  // sound is playing) — React state updates are async, so `submitting`
  // alone can't be trusted to block a second call that fires before the
  // first re-render lands.
  const submittingRef = useRef(false);
  // The currently-playing 10-seconds-left Audio instance (or null) — kept
  // so it can be stopped early the moment the question is answered/changes,
  // since the clip itself runs longer than the 10 seconds it announces.
  const warningAudioRef = useRef(null);
  // Guards the 10s warning sound so it plays exactly once per question,
  // even across React re-renders/StrictMode's dev double-invoke.
  const tenSecondPlayedRef = useRef(false);

  const total = questions?.length || 0;
  const current = total > 0 ? questions[viewIndex] : undefined;
  const isLast = total > 0 && viewIndex === total - 1;
  const progressPercent = total > 0 ? Math.round((viewIndex / total) * 100) : 0;

  const submitAnswer = async (position) => {
    if (submittingRef.current || !current || current.answered) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    stopSound(warningAudioRef.current);
    warningAudioRef.current = null;
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

  // New question: clear the 10s-warning dedup guard and stop/discard any
  // still-playing warning sound from the previous question (ref mutation +
  // side effect, so it belongs in an effect rather than the render-time
  // reset above).
  useEffect(() => {
    tenSecondPlayedRef.current = false;
    stopSound(warningAudioRef.current);
    warningAudioRef.current = null;
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

  // 10-seconds-left warning sound — plays exactly once per question, the
  // instant the countdown reaches TEN_SECOND_WARNING_AT, deduped via
  // tenSecondPlayedRef so it never replays on re-render.
  useEffect(() => {
    if (!current || current.answered || submitting) return;
    if (secondsLeft !== TEN_SECOND_WARNING_AT) return;
    if (tenSecondPlayedRef.current) return;

    tenSecondPlayedRef.current = true;
    warningAudioRef.current = playTenSecondWarningSound();
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

  // Stop any playing warning sound when the player unmounts (e.g. the user
  // navigates away from the quiz mid-countdown).
  useEffect(() => {
    return () => {
      stopSound(warningAudioRef.current);
    };
  }, []);

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

      <Card
        className={cx(
          "flex flex-col gap-4 border-2 transition-shadow motion-safe:duration-300",
          resultState === "correct" && "border-green-500 shadow-lg shadow-green-500/30",
          resultState === "wrong" && "border-danger shadow-lg shadow-danger/30",
          !resultState && "border-line",
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
