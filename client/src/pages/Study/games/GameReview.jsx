import { ArrowBackRounded, CheckCircle, ErrorOutlined, Replay } from "@mui/icons-material";
import { motion as Motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";

import Button from "../../../components/ui/Button";
import { ResourceState, useResource } from "../../../utility/helpers";
import useButtonColorFix from "../../../utility/useButtonColorFix";
import GameResultCard from "./components/GameResultCard";
import MistakeCard from "./components/MistakeCard";
import useGameAnimation from "./hooks/useGameAnimation";
import { gamesHomePath, toneFor } from "./utility/gameTypes";

/**
 * Last-game review: the result numbers plus only the questions that were
 * answered wrongly or timed out, with the correct answers. Available only
 * for a COMPLETED attempt (the server refuses otherwise), and reached from
 * the result screen or the "last game" card on the Games page.
 * Route: /study/games/review/:attemptId
 */
export default function GameReview() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const review = useResource(`/games/attempts/${attemptId}/review`);
  const motionVariants = useGameAnimation();
  const primaryFix = useButtonColorFix("primary");
  const outlineFix = useButtonColorFix("outline");
  const data = review.data;
  const backToGames = () => navigate(gamesHomePath(data?.category));

  return (
    <div className="games-scope mx-auto flex w-full max-w-xl min-w-0 flex-col gap-4" data-tone={toneFor(data?.category)}>
      <div>
        <button
          type="button"
          onClick={backToGames}
          className="inline-flex items-center gap-1 rounded-md py-1 pr-2 text-xs font-semibold text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ArrowBackRounded style={{ fontSize: 16 }} /> All games
        </button>
      </div>

      <ResourceState loading={review.loading} error={review.error}>
        {data && (
          <Motion.div
            className="flex flex-col gap-5"
            variants={motionVariants.resultContainer}
            initial="hidden"
            animate="show"
          >
            <Motion.header variants={motionVariants.resultItem} className="flex items-center gap-3">
              <span className="game-tile game-tile--sm" aria-hidden="true">
                {data.icon}
              </span>
              <div className="min-w-0">
                <h1 className="truncate font-display text-xl leading-tight font-semibold text-ink">Review mistakes</h1>
                <p className="truncate text-xs font-semibold text-muted">{data.gameName} · your last completed game</p>
              </div>
            </Motion.header>

            <GameResultCard
              score={data.score}
              total={data.totalQuestions}
              correctCount={data.correctCount}
              wrongCount={data.wrongCount}
              timeoutCount={data.timeoutCount}
              accuracy={data.accuracy}
              itemVariants={motionVariants.resultItem}
            />

            <Motion.section variants={motionVariants.resultItem} className="flex flex-col gap-3">
              <h2 className="text-sm font-bold tracking-wide text-ink uppercase">
                Mistakes ({data.mistakes.length})
              </h2>

              {data.mistakes.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-panel px-4 py-10 text-center shadow-soft">
                  <CheckCircle style={{ fontSize: 34, color: "var(--game-correct)" }} />
                  <p className="font-display text-lg font-semibold text-ink">No mistakes — perfect game!</p>
                  <p className="text-xs text-muted">Every question was answered correctly and in time.</p>
                </div>
              ) : (
                data.mistakes.map((mistake) => <MistakeCard key={mistake.index} mistake={mistake} />)
              )}
            </Motion.section>

            <Motion.div variants={motionVariants.resultItem} className="flex w-full gap-2.5">
              <Button
                variant="outline"
                className="min-w-0 flex-1"
                onClick={backToGames}
                style={outlineFix.style}
                onMouseEnter={outlineFix.onMouseEnter}
                onMouseLeave={outlineFix.onMouseLeave}
              >
                Back to Games
              </Button>
              <Button
                variant="primary"
                className="min-w-0 flex-1"
                onClick={() => navigate(`/study/games/play/${data.gameType}`)}
                style={primaryFix.style}
                onMouseEnter={primaryFix.onMouseEnter}
                onMouseLeave={primaryFix.onMouseLeave}
              >
                <Replay fontSize="small" />
                Play Again
              </Button>
            </Motion.div>
          </Motion.div>
        )}
      </ResourceState>

      {review.error && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={backToGames}
            style={outlineFix.style}
            onMouseEnter={outlineFix.onMouseEnter}
            onMouseLeave={outlineFix.onMouseLeave}
          >
            <ErrorOutlined fontSize="small" />
            Back to Games
          </Button>
        </div>
      )}
    </div>
  );
}
