import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../../../../utility/api";
import { ANSWER_STATE, RESULT_HOLD_MS, TRANSITION_MS } from "../utility/gameTypes";

const errorMessage = (error, fallback) => error.response?.data?.error?.message || fallback;

// Client side of one game session. It owns *presentation* state — which
// question is on screen, the current answer-state, the ~1s result hold — and
// nothing authoritative: the questions, the correct answer, score, counts
// and completion all come back from the server, which is the only thing
// that ever grades an answer.
//
// It is game-agnostic: it just needs a gameType. A math game and a future
// English game run through exactly the same code. (The caller keys the
// component by gameType, so a different game always starts from a clean
// "loading" state.)
//
// One question's flow:
//   select(position)
//     -> POST answer (option shows a "pending" state meanwhile)
//     -> server says correct/wrong  -> ANSWER_STATE.CORRECT | WRONG   (~1s)
//     -> ANSWER_STATE.TRANSITIONING (short fade-out)
//     -> next question, ANSWER_STATE.PLAYING   — or the result screen
export default function useGameSession(gameType) {
  const [phase, setPhase] = useState("loading"); // loading | error | playing | complete
  const [loadError, setLoadError] = useState("");
  const [session, setSession] = useState(null);
  const [index, setIndex] = useState(0);
  const [answerState, setAnswerState] = useState(ANSWER_STATE.PLAYING);
  const [feedback, setFeedback] = useState(null); // { selectedPosition, correctPosition, correct }
  const [pendingPosition, setPendingPosition] = useState(null);
  const [answerError, setAnswerError] = useState("");
  const [result, setResult] = useState(null);

  // The lock is a ref, not state, so a second tap in the same frame is
  // rejected synchronously — before React has re-rendered.
  const lockedRef = useRef(false);
  const timersRef = useRef([]);
  const runRef = useRef(0);

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

  const showComplete = (data) => {
    setResult({
      score: data.score,
      correctCount: data.correctCount,
      wrongCount: data.wrongCount,
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
      setResult(null);
      setPhase("playing");
    } catch (error) {
      if (run !== runRef.current) return;
      setLoadError(errorMessage(error, "Couldn't start this game."));
      setPhase("error");
    }
  }, [gameType, resetQuestionUi]);

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
      }
    } catch {
      /* leave the screen as-is; the next tap will surface a real error */
    }
  };

  const select = async (position) => {
    if (!session || phase !== "playing" || answerState !== ANSWER_STATE.PLAYING) return;
    if (lockedRef.current) return;
    lockedRef.current = true;

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
      const outcome = data.data;

      setFeedback({
        selectedPosition: position,
        correctPosition: outcome.correctPosition,
        correct: outcome.correct,
      });
      setAnswerState(outcome.correct ? ANSWER_STATE.CORRECT : ANSWER_STATE.WRONG);
      setPendingPosition(null);
      setSession((current) => ({
        ...current,
        score: outcome.score,
        correctCount: outcome.correctCount,
        wrongCount: outcome.wrongCount,
      }));

      later(() => setAnswerState(ANSWER_STATE.TRANSITIONING), RESULT_HOLD_MS);
      later(() => {
        if (outcome.isComplete) {
          showComplete(outcome);
        } else {
          setIndex((current) => current + 1);
          resetQuestionUi();
        }
      }, RESULT_HOLD_MS + TRANSITION_MS);
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

  const total = session?.totalQuestions || 0;
  // A question counts as answered the moment its result is on screen, so the
  // progress bar advances immediately rather than one question late.
  const answered = index + (answerState === ANSWER_STATE.PLAYING ? 0 : 1);

  return {
    phase,
    loadError,
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
    select,
    restart,
  };
}
