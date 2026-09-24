import { ArrowBackRounded, ErrorOutlined } from "@mui/icons-material";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import Button from "../../../components/ui/Button";
import { cx } from "../../../utility/cx";
import useButtonColorFix from "../../../utility/useButtonColorFix";
import GameHeader from "./components/GameHeader";
import GameOption from "./components/GameOption";
import GameProgress from "./components/GameProgress";
import GameTimer from "./components/GameTimer";
import GameQuestion from "./components/GameQuestion";
import GameResult from "./GameResult";
import useGameAnimation from "./hooks/useGameAnimation";
import useGameSession from "./hooks/useGameSession";
import { ANSWER_STATE, OPTION_LETTERS, toneFor } from "./utility/gameTypes";

// Short numeric answers fit two-up even on a 320px phone; longer text
// (future English options) stacks on small screens instead of overflowing.
const optionGridClass = (options) => {
  const longest = Math.max(...options.map((option) => option.length));
  if (longest > 40) return "grid-cols-1";
  return longest > 14 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2";
};

const optionState = (position, feedback, pendingPosition) => {
  if (feedback) {
    if (position === feedback.correctPosition) return "correct";
    if (position === feedback.selectedPosition) return "wrong";
    return "dimmed";
  }
  return pendingPosition === position ? "pending" : "idle";
};

function PlayerSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading game" className="flex animate-pulse flex-col gap-4 motion-reduce:animate-none">
      <div className="flex items-center gap-3">
        <div className="size-9.5 rounded-xl bg-soft" />
        <div className="h-4 w-32 rounded bg-soft" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="h-14 rounded-xl bg-soft" />
        <div className="h-14 rounded-xl bg-soft" />
        <div className="h-14 rounded-xl bg-soft" />
      </div>
      <div className="h-2.5 rounded-full bg-soft" />
      <div className="h-72 rounded-3xl bg-soft" />
    </div>
  );
}

/**
 * The one player for every game. It knows nothing about math or English —
 * the server supplies the questions, the session hook runs the flow, and the
 * reusable components render it. Route: /study/games/play/:gameType
 */
export default function GamePlayer() {
  const { gameType } = useParams();
  // Keyed so opening a different game always starts from a clean session.
  return <GamePlayerScreen key={gameType} gameType={gameType} />;
}

function GamePlayerScreen({ gameType }) {
  const navigate = useNavigate();
  const game = useGameSession(gameType);
  const motionVariants = useGameAnimation();
  const primaryFix = useButtonColorFix("primary");
  const outlineFix = useButtonColorFix("outline");

  const { phase, session, question, answerState, feedback, pendingPosition, select } = game;
  const backToGames = () => navigate("/study/games");
  const timer = game.timer;
  const locked = answerState !== ANSWER_STATE.PLAYING || pendingPosition !== null;
  const tone = toneFor(session?.category);

  // Keyboard: 1–4 (or A–D) pick the matching option.
  useEffect(() => {
    if (phase !== "playing" || !question) return undefined;
    const onKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toUpperCase();
      const position = /^[1-4]$/.test(key) ? Number(key) - 1 : OPTION_LETTERS.indexOf(key);
      if (position >= 0 && position < question.options.length) select(position);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, question, select]);

  return (
    <div className="games-scope mx-auto flex w-full max-w-xl min-w-0 flex-col gap-4" data-tone={tone}>
      <div>
        <button
          type="button"
          onClick={backToGames}
          className="inline-flex items-center gap-1 rounded-md py-1 pr-2 text-xs font-semibold text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ArrowBackRounded style={{ fontSize: 16 }} /> All games
        </button>
      </div>

      {phase === "loading" && <PlayerSkeleton />}

      {phase === "error" && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-panel px-6 py-14 text-center shadow-soft">
          <div className="flex size-11 items-center justify-center rounded-full bg-danger-soft text-danger">
            <ErrorOutlined fontSize="small" />
          </div>
          <p className="max-w-xs text-sm text-muted">{game.loadError}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={backToGames}
              style={outlineFix.style}
              onMouseEnter={outlineFix.onMouseEnter}
              onMouseLeave={outlineFix.onMouseLeave}
            >
              Back to Games
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={game.restart}
              style={primaryFix.style}
              onMouseEnter={primaryFix.onMouseEnter}
              onMouseLeave={primaryFix.onMouseLeave}
            >
              Try again
            </Button>
          </div>
        </div>
      )}

      {phase === "playing" && session && question && (
        <>
          <GameHeader
            name={session.gameName}
            icon={session.icon}
            questionNumber={game.questionNumber}
            total={game.total}
            score={session.score}
            correctCount={session.correctCount}
            wrongCount={session.wrongCount}
            pop={motionVariants.statPop}
            timer={
              timer.enabled ? (
                <GameTimer
                  secondsLeft={timer.secondsLeft}
                  remainingMs={timer.remainingMs}
                  limitSec={timer.limitSec}
                  running={timer.running}
                />
              ) : null
            }
          />

          <GameProgress {...game.progress} />

          <GameQuestion
            key={game.questionNumber}
            prompt={question.prompt}
            state={answerState}
            timedOut={Boolean(feedback?.timedOut)}
            motionVariants={motionVariants}
          >
            <div className={cx("grid gap-2.5 sm:gap-3", optionGridClass(question.options))}>
              {question.options.map((label, position) => (
                <GameOption
                  key={position}
                  letter={OPTION_LETTERS[position]}
                  label={label}
                  state={optionState(position, feedback, pendingPosition)}
                  disabled={locked}
                  onSelect={() => select(position)}
                  tap={motionVariants.optionTap}
                />
              ))}
            </div>

            {game.answerError && (
              <p role="alert" className="mt-3 text-center text-xs font-medium text-danger">
                {game.answerError}
              </p>
            )}
          </GameQuestion>
        </>
      )}

      {phase === "complete" && game.result && (
        <GameResult
          result={game.result}
          gameName={session?.gameName}
          motionVariants={motionVariants}
          onPlayAgain={game.restart}
          onBack={backToGames}
          onReview={() => navigate(`/study/games/review/${game.result.attemptId}`)}
        />
      )}
    </div>
  );
}
