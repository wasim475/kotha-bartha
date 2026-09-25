import { ArrowBackRounded, ErrorOutlined } from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ConfirmDialog from "../../../../components/ui/ConfirmDialog";
import { cx } from "../../../../utility/cx";
import { playCorrectAnswerSound, playWrongAnswerSound } from "../../../../utility/sound";
import FixedButton from "../components/FixedButton";
import GameOption from "../components/GameOption";
import GameProgress from "../components/GameProgress";
import GameQuestion from "../components/GameQuestion";
import GameTimer from "../components/GameTimer";
import useGameAnimation from "../hooks/useGameAnimation";
import { ANSWER_STATE, OPTION_LETTERS, gamesHomePath, toneFor } from "../utility/gameTypes";
import ChallengeHeader from "./ChallengeHeader";
import ChallengeResult from "./ChallengeResult";
import useChallengeMatch from "./useChallengeMatch";

const optionGridClass = (options) => {
  const longest = Math.max(...options.map((option) => option.length));
  if (longest > 40) return "grid-cols-1";
  return longest > 14 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2";
};

// The countdown for the question on screen. The server's clock decides
// everything; this only DRAWS the time the server said was left when it sent
// the question (a fresh view from the server — e.g. after a reconnect — mounts
// a fresh timer, so the clock is never restarted by the client).
function QuestionTimer({ remainingMs, limitSec, running }) {
  const [deadline] = useState(() => performance.now() + remainingMs);
  const [left, setLeft] = useState(remainingMs);

  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, deadline - performance.now())), 100);
    return () => clearInterval(id);
  }, [deadline]);

  return <GameTimer secondsLeft={Math.ceil(left / 1000)} remainingMs={left} limitSec={limitSec} running={running && left > 0} />;
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading match" className="flex animate-pulse flex-col gap-4 motion-reduce:animate-none">
      <div className="flex items-center gap-3">
        <div className="size-9.5 rounded-xl bg-soft" />
        <div className="h-4 w-32 rounded bg-soft" />
      </div>
      <div className="h-16 rounded-2xl bg-soft" />
      <div className="h-2.5 rounded-full bg-soft" />
      <div className="h-72 rounded-3xl bg-soft" />
    </div>
  );
}

/**
 * The live friend-challenge screen. Route: /study/games/challenge/:matchId
 * Both players answer the same question independently; the server resolves it
 * once both have answered (or the clock runs out), shows the result to both,
 * then moves both on together. This screen only renders the server's state
 * and sends the tapped option position.
 */
export default function ChallengeMatch() {
  const { matchId } = useParams();
  // Keyed so a rematch (a different match id) always starts from a clean screen.
  return <ChallengeMatchScreen key={matchId} matchId={matchId} />;
}

function ChallengeMatchScreen({ matchId }) {
  const navigate = useNavigate();
  const flow = useChallengeMatch(matchId);
  const motionVariants = useGameAnimation();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const soundedIndex = useRef(null);

  const { match, pendingPosition } = flow;
  const active = match?.status === "active";
  const backToGames = () => navigate(gamesHomePath(match?.category));

  // What is on screen: the open question, or the result of the last resolved one.
  const current = active ? match?.current : null;
  const lastResult = match?.results?.length ? match.results[match.results.length - 1] : null;
  const showingResult = !current && lastResult && (active || !flow.finalRevealed);
  const outcome = showingResult ? lastResult.you.outcome : null;

  // Correct / wrong sound, once for each newly shown result.
  const resultIndex = showingResult ? lastResult.index : null;
  useEffect(() => {
    if (resultIndex === null) return;
    if (soundedIndex.current === null) soundedIndex.current = resultIndex - 1;
    if (resultIndex > soundedIndex.current) {
      soundedIndex.current = resultIndex;
      if (outcome === "correct") playCorrectAnswerSound();
      else if (outcome) playWrongAnswerSound();
    }
  }, [resultIndex, outcome]);

  // Keyboard: 1–4 (or A–D) pick the matching option.
  const canAnswer = Boolean(current && !current.answered && pendingPosition === null);
  const optionCount = current?.options.length || 0;
  const answer = flow.answer;
  useEffect(() => {
    if (!canAnswer) return undefined;
    const onKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toUpperCase();
      const position = /^[1-4]$/.test(key) ? Number(key) - 1 : OPTION_LETTERS.indexOf(key);
      if (position >= 0 && position < optionCount) answer(position);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canAnswer, optionCount, answer]);

  const confirmAndLeave = async () => {
    const left = await flow.leave();
    setConfirmLeave(false);
    if (left) backToGames();
  };

  const showFinal = match && !active && flow.finalRevealed;
  const questionMatch = match && (current || showingResult);

  // Opponent / progress status line.
  // My own tap counts as answered the moment it is sent (the server confirms right after).
  const iAnswered = Boolean(current && (current.answered || pendingPosition !== null));
  let status = null;
  if (current) {
    if (iAnswered && current.opponentAnswered) status = { key: "both", tone: "ready", text: "Both locked in…" };
    else if (iAnswered) status = { key: "wait", tone: "wait", text: `Waiting for ${match.opponent.fullName}…` };
    else if (current.opponentAnswered) status = { key: "ans", tone: "answered", text: `${match.opponent.fullName}: 🟢 Answered` };
    else status = { key: "think", tone: "wait", text: `${match.opponent.fullName}: ⏳ Thinking…` };
  } else if (showingResult && active) {
    status = { key: "next", tone: "ready", text: "Next question coming up…" };
  }

  const timer = current ? (
    <QuestionTimer
      key={`${current.index}-${Math.round(current.remainingMs)}`}
      remainingMs={current.remainingMs}
      limitSec={match.timeLimitSec}
      running={!iAnswered}
    />
  ) : null;

  const optionsFor = current || lastResult;
  const optionState = (position) => {
    if (current) return current.selectedPosition === position || pendingPosition === position ? "pending" : "idle";
    if (position === lastResult.correctPosition) return "correct";
    if (position === lastResult.you.selectedPosition) return "wrong";
    return "dimmed";
  };
  const opponentBadge = (position) =>
    showingResult && lastResult.opponent.selectedText !== null && lastResult.options[position] === lastResult.opponent.selectedText ? (
      <span className="ch-opt-badge" title={`${match.opponent.fullName}'s answer`} aria-label={`${match.opponent.fullName} chose this`}>
        {match.opponent.initials || match.opponent.fullName.slice(0, 2)}
      </span>
    ) : null;

  const answerState = current ? ANSWER_STATE.PLAYING : outcome === "correct" ? ANSWER_STATE.CORRECT : ANSWER_STATE.WRONG;

  return (
    <div className="games-scope mx-auto flex w-full max-w-xl min-w-0 flex-col gap-4" data-tone={toneFor(match?.category)}>
      <div>
        <button
          type="button"
          onClick={() => (active ? setConfirmLeave(true) : backToGames())}
          className="inline-flex items-center gap-1 rounded-md py-1 pr-2 text-xs font-semibold text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ArrowBackRounded style={{ fontSize: 16 }} /> {active ? "Leave match" : "All games"}
        </button>
      </div>

      {flow.loading && <Skeleton />}

      {!flow.loading && flow.error && !match && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-panel px-6 py-14 text-center shadow-soft">
          <div className="flex size-11 items-center justify-center rounded-full bg-danger-soft text-danger">
            <ErrorOutlined fontSize="small" />
          </div>
          <p className="max-w-xs text-sm text-muted">{flow.error}</p>
          <FixedButton variant="outline" size="sm" onClick={backToGames}>
            Back to Games
          </FixedButton>
        </div>
      )}

      {questionMatch && (
        <>
          <ChallengeHeader match={match} timer={timer} status={status} />

          <GameProgress
            answered={showingResult ? lastResult.index + 1 : match.currentIndex}
            total={match.total}
            percent={Math.round(((showingResult ? lastResult.index + 1 : match.currentIndex) / match.total) * 100)}
          />

          <GameQuestion
            key={optionsFor.index}
            prompt={optionsFor.prompt}
            state={answerState}
            timedOut={outcome === "timeout"}
            motionVariants={motionVariants}
          >
            <div className={cx("grid gap-2.5 sm:gap-3", optionGridClass(optionsFor.options))}>
              {optionsFor.options.map((label, position) => (
                <GameOption
                  key={position}
                  letter={OPTION_LETTERS[position]}
                  label={label}
                  state={optionState(position)}
                  disabled={!canAnswer}
                  onSelect={() => answer(position)}
                  tap={motionVariants.optionTap}
                  badge={opponentBadge(position)}
                />
              ))}
            </div>

            {showingResult && (
              <p className="ch-picks" role="status">
                <span data-outcome={lastResult.you.outcome}>You: {lastResult.you.outcome === "timeout" ? "no answer" : lastResult.you.selectedText}</span>
                <span data-outcome={lastResult.opponent.outcome}>
                  {match.opponent.fullName}: {lastResult.opponent.outcome === "timeout" ? "no answer" : lastResult.opponent.selectedText}
                </span>
              </p>
            )}

            {flow.answerError && (
              <p role="alert" className="mt-3 text-center text-xs font-medium text-danger">
                {flow.answerError}
              </p>
            )}
          </GameQuestion>
        </>
      )}

      {showFinal && <ChallengeResult match={match} flow={flow} onBack={backToGames} />}

      <ConfirmDialog
        open={confirmLeave}
        title="Leave this match?"
        description="Leaving ends the match right now. Nobody gets any points, and your opponent will be told you left."
        confirmLabel="Leave match"
        cancelLabel="Keep playing"
        variant="danger"
        loading={flow.acting}
        onConfirm={confirmAndLeave}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
