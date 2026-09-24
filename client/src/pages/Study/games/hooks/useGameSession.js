import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../../../../utility/api";
import { playCorrectAnswerSound, playWrongAnswerSound } from "../../../../utility/sound";
import { ANSWER_STATE, RESULT_HOLD_MS, TRANSITION_MS } from "../utility/gameTypes";

const errorMessage = (error, fallback) => error.response?.data?.error?.message || fallback;

// Client side of one game session. It owns *presentation* state — which
// question is on screen, the current answer-state, the ~1s result hold, the
// countdown display — and nothing authoritative: the questions, the correct
// answer, score, counts, the verdict on whether an answer was in time, and
// completion all come back from the server, which is the only thing that
// ever grades anything.
//
// It is game-agnostic: it just needs a gameType. A game is "timed" purely
// because the server's attempt says so (`timeLimitSec`), which comes from the
// game's registry entry — there is no per-game logic here. (The caller keys
// the component by gameType, so a different game always starts from a clean
// "loading" state.)
//
// One question's flow:
//   countdown running (timed games only)
//   select(position)  ─┐
//   countdown hits 0  ─┴-> POST answer (option shows a "pending" state)
//     -> server verdict: correct | wrong | timed out  -> ANSWER_STATE.CORRECT | WRONG
//     -> ~1s hold, sound, animation
//     -> ANSWER_STATE.TRANSITIONING (short fade-out)
//     -> next question, ANSWER_STATE.PLAYING, countdown restarts — or the result screen
export default function useGameSession(gameType) {
  const [phase, setPhase] = useState("loading"); // loading | error | playing | complete
  const [loadError, setLoadError] = useState("");
  const [loadErrorCode, setLoadErrorCode] = useState("");
  const [session, setSession] = useState(null);
  const [index, setIndex] = useState(0);
  const [answerState, setAnswerState] = useState(ANSWER_STATE.PLAYING);
  const [feedback, setFeedback] = useState(null); // { selectedPosition, correctPosition, correct, timedOut }
  const [pendingPosition, setPendingPosition] = useState(null);
  const [answerError, setAnswerError] = useState("");
  const [result, setResult] = useState(null);
  // Milliseconds left on the CURRENT question's countdown (null = untimed).
  const [remainingMs, setRemainingMs] = useState(null);

  // The lock is a ref, not state, so a second tap (or a tap racing the
  // countdown) in the same frame is rejected synchronously — before React
  // has re-rendered.
  const lockedRef = useRef(false);
  const timersRef = useRef([]);
  const runRef = useRef(0);
  // When the current countdown ends, on the browser's monotonic clock. Only
  // used to DRAW the timer and to know when to report a timeout — the server
  // independently measures the same window on its own clock.
  const deadlineRef = useRef(0);
  const timeoutHandlerRef = useRef(() => {});

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  // Invalidates every in-flight request/timer of the current run.
  const cancelRun = useCallback(() => {
    runRef.current += 1;
    clearTimers();
  }, [clearTimers]);

  const later = (fn, ms) => {
    timersRef.current.push(setTimeout(fn, ms));
  };

  const resetQuestionUi = useCallback(() => {
    setAnswerState(ANSWER_STATE.PLAYING);
    setFeedback(null);
    setPendingPosition(null);
    setAnswerError("");
    lockedRef.current = false;
  }, []);

  // Points the countdown at `ms` from now (or clears it for untimed games).
  const armCountdown = useCallback((ms) => {
    if (ms == null) {
      setRemainingMs(null);
      return;
    }
    deadlineRef.current = performance.now() + ms;
    setRemainingMs(ms);
  }, []);

  const showComplete = (data) => {
    setResult({
      attemptId: data.attemptId,
      gameType: data.gameType,
      score: data.score,
      correctCount: data.correctCount,
      wrongCount: data.wrongCount,
      timeoutCount: data.timeoutCount || 0,
      accuracy: data.accuracy,
      totalQuestions: data.totalQuestions,
    });
    setPhase("complete");
  };

  // Fetches a fresh attempt (or resumes an unfinished one — the server
  // decides). State is only set after the response, never synchronously.
  const load = useCallback(async () => {
    runRef.current += 1;
    const run = runRef.current;

    try {
      const { data } = await api.post(`/games/${gameType}/start`);
      if (run !== runRef.current) return;
      const attempt = data.data;
      setSession(attempt);
      setIndex(attempt.currentIndex);
      resetQuestionUi();
      // On a resume the server reports how much of the current question's
      // window is actually left, so a refresh can't buy extra time.
      armCountdown(attempt.remainingMs);
      setResult(null);
      setPhase("playing");
    } catch (error) {
      if (run !== runRef.current) return;
      setLoadError(errorMessage(error, "Couldn't start this game."));
      setLoadErrorCode(error.response?.data?.error?.code || "");
      setPhase("error");
    }
  }, [gameType, resetQuestionUi, armCountdown]);

  useEffect(() => {
    // Initial request hydrates the session from the API; state is only set
    // after the response resolves (and ignored if this run was cancelled).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    return cancelRun;
  }, [load, cancelRun]);

  // Play Again / Try again: back to the loading state, then a new attempt.
  const restart = () => {
    clearTimers();
    lockedRef.current = false;
    setLoadError("");
    setLoadErrorCode("");
    setPhase("loading");
    load();
  };

  // Re-syncs with the server after a rejected answer (out of sequence /
  // already finished), so the screen always ends up where the server is.
  const resync = async (attemptId) => {
    const run = runRef.current;
    try {
      const { data } = await api.get(`/games/attempts/${attemptId}`);
      if (run !== runRef.current) return;
      const attempt = data.data;
      setSession(attempt);
      if (attempt.status === "completed") {
        showComplete(attempt);
      } else {
        setIndex(attempt.currentIndex);
        armCountdown(attempt.remainingMs);
      }
    } catch {
      /* leave the screen as-is; the next tap will surface a real error */
    }
  };

  // Shows the server's verdict for one question — identical for a tap and a
  // timeout, which is what makes a timeout look exactly like a wrong answer
  // (red state, glow, shake, sound, ~1s hold, then automatically onward).
  const applyOutcome = (outcome, position) => {
    setFeedback({
      selectedPosition: outcome.timedOut ? null : position,
      correctPosition: outcome.correctPosition,
      correct: outcome.correct,
      timedOut: Boolean(outcome.timedOut),
    });
    setAnswerState(outcome.correct ? ANSWER_STATE.CORRECT : ANSWER_STATE.WRONG);
    setPendingPosition(null);
    setSession((current) => ({
      ...current,
      score: outcome.score,
      correctCount: outcome.correctCount,
      wrongCount: outcome.wrongCount,
    }));
    (outcome.correct ? playCorrectAnswerSound : playWrongAnswerSound)();

    const limitMs = session?.timeLimitSec ? session.timeLimitSec * 1000 : null;
    later(() => setAnswerState(ANSWER_STATE.TRANSITIONING), RESULT_HOLD_MS);
    later(() => {
      if (outcome.isComplete) {
        showComplete(outcome);
      } else {
        setIndex((current) => current + 1);
        resetQuestionUi();
        // The countdown restarts ONLY now, when the next question appears.
        armCountdown(limitMs);
      }
    }, RESULT_HOLD_MS + TRANSITION_MS);
  };

  const select = async (position) => {
    if (!session || phase !== "playing" || answerState !== ANSWER_STATE.PLAYING) return;
    if (lockedRef.current) return;
    lockedRef.current = true; // also stops the countdown (see the ticking effect)

    const run = runRef.current;
    const attemptId = session.attemptId;
    setAnswerError("");
    setPendingPosition(position);

    try {
      const { data } = await api.post(`/games/attempts/${attemptId}/answer`, {
        questionIndex: index,
        selectedPosition: position,
      });
      if (run !== runRef.current) return;
      applyOutcome(data.data, position);
    } catch (error) {
      if (run !== runRef.current) return;
      lockedRef.current = false;
      setPendingPosition(null);

      const code = error.response?.data?.error?.code;
      if (code === "OUT_OF_SEQUENCE" || code === "ALREADY_COMPLETED") {
        await resync(attemptId);
        return;
      }
      setAnswerError(errorMessage(error, "Couldn't save that answer. Tap it again."));
    }
  };

  // The countdown reached zero with nothing chosen. The client only REPORTS
  // it; the server checks its own clock and decides (and may say "too early"
  // if this browser's timer ran ahead, in which case we simply try again).
  const submitTimeout = async () => {
    if (!session || phase !== "playing" || answerState !== ANSWER_STATE.PLAYING) return;
    if (lockedRef.current) return;
    lockedRef.current = true;

    const run = runRef.current;
    const attemptId = session.attemptId;
    setAnswerError("");

    try {
      const { data } = await api.post(`/games/attempts/${attemptId}/answer`, {
        questionIndex: index,
        timedOut: true,
      });
      if (run !== runRef.current) return;
      applyOutcome(data.data, null);
    } catch (error) {
      if (run !== runRef.current) return;
      lockedRef.current = false;

      const code = error.response?.data?.error?.code;
      if (code === "OUT_OF_SEQUENCE" || code === "ALREADY_COMPLETED") {
        await resync(attemptId);
        return;
      }
      if (code === "TOO_EARLY") {
        later(submitTimeout, (error.response.data.error.retryAfterMs || 200) + 50);
        return;
      }
      setAnswerError("Connection problem — retrying…");
      later(submitTimeout, 1500);
    }
  };

  // The freshest submitTimeout for the countdown interval to call.
  useEffect(() => {
    timeoutHandlerRef.current = submitTimeout;
  });

  const timed = Boolean(session?.timeLimitSec);
  // The countdown runs only while a question is open and unanswered. The
  // moment an option is tapped (pendingPosition) or a result is showing, this
  // turns false and the interval is torn down — the timer stops immediately.
  const ticking = timed && phase === "playing" && answerState === ANSWER_STATE.PLAYING && pendingPosition === null;

  useEffect(() => {
    if (!ticking) return undefined;
    const intervalId = setInterval(() => {
      if (lockedRef.current) return;
      // Re-derived from a fixed deadline every tick (not decremented), so it
      // can't drift and a throttled background tab still expires on time.
      const left = Math.max(0, deadlineRef.current - performance.now());
      setRemainingMs(left);
      if (left <= 0) {
        clearInterval(intervalId);
        timeoutHandlerRef.current();
      }
    }, 100);
    return () => clearInterval(intervalId);
  }, [ticking, index]);

  const total = session?.totalQuestions || 0;
  // A question counts as answered the moment its result is on screen, so the
  // progress bar advances immediately rather than one question late.
  const answered = index + (answerState === ANSWER_STATE.PLAYING ? 0 : 1);
  const limitSec = session?.timeLimitSec || null;

  return {
    phase,
    loadError,
    loadErrorCode,
    session,
    question: session?.questions?.[index] || null,
    questionNumber: Math.min(index + 1, total || 1),
    total,
    answerState,
    feedback,
    pendingPosition,
    answerError,
    result,
    progress: {
      answered,
      total,
      percent: total ? Math.round((answered / total) * 100) : 0,
    },
    timer: {
      enabled: timed,
      limitSec,
      remainingMs: remainingMs ?? 0,
      secondsLeft: Math.ceil((remainingMs ?? 0) / 1000),
      running: ticking,
    },
    select,
    restart,
  };
}
