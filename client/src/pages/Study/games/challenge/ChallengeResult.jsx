import { FactCheck, Replay } from "@mui/icons-material";
import { AnimatePresence, motion as Motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

import FixedButton from "../components/FixedButton";
import ChallengeReview from "./ChallengeReview";

// A small burst of dots for a win — fixed angles/distances (nothing random in
// render), transform/opacity only, dropped entirely with reduced motion.
const CONFETTI = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2 + 0.2;
  const distance = 90 + (i % 4) * 26;
  return { id: i, x: Math.cos(angle) * distance, y: Math.sin(angle) * distance - 20, delay: (i % 5) * 0.04, tone: i % 3 };
});

const COPY = {
  won: { emoji: "🏆", title: "YOU WIN!", sub: "Nicely played." },
  lost: { emoji: "😔", title: "YOU LOSE", sub: "Good fight — try a rematch." },
  draw: { emoji: "🤝", title: "DRAW", sub: "Dead even." },
};

function Tile({ label, value, kind }) {
  return (
    <div className="game-result-tile" data-kind={kind}>
      <span className="text-[10px] font-bold tracking-wide text-muted uppercase">{label}</span>
      <span className="game-result-tile-value">{value}</span>
    </div>
  );
}

function BigScore({ label, value, delay, strong }) {
  const reduced = useReducedMotion();
  return (
    <Motion.div
      className="ch-bigscore"
      data-strong={strong ? "true" : "false"}
      initial={reduced ? false : { opacity: 0, scale: 0.6, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20, delay: reduced ? 0 : delay }}
    >
      <span className="text-[11px] font-bold tracking-wide text-muted uppercase">{label}</span>
      <span className="ch-bigscore-value">{value}</span>
    </Motion.div>
  );
}

/**
 * The end-of-match screen: win / lose / draw, both scores, the player's
 * correct / wrong / timeout counts, the leaderboard reward (winner only), a
 * full question-by-question review, and Play Again — a rematch REQUEST, never a
 * forced restart. Every number is the server's. `flow` is the match hook
 * (rematch actions and their state).
 */
export default function ChallengeResult({ match, flow, onBack }) {
  const reduced = useReducedMotion();
  const [reviewing, setReviewing] = useState(false);
  const abandoned = match.status === "abandoned";
  const outcome = match.outcome;
  const copy = COPY[outcome];
  const you = match.totals.you;
  const rematch = match.rematch;
  const iLeft = match.abandonedBy === match.you.id;

  return (
    <Motion.div
      className="ch-result mx-auto flex w-full max-w-md flex-col items-center gap-5 text-center"
      data-outcome={abandoned ? "left" : outcome}
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="ch-hero">
        {outcome === "won" && !reduced && (
          <div className="ch-confetti" aria-hidden="true">
            {CONFETTI.map((piece) => (
              <Motion.span
                key={piece.id}
                className="ch-confetto"
                data-tone={piece.tone}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0.5 }}
                animate={{ x: piece.x, y: piece.y, opacity: [0, 1, 0], scale: [0.5, 1, 0.6] }}
                transition={{ duration: 1.3, delay: 0.15 + piece.delay, ease: "easeOut" }}
              />
            ))}
          </div>
        )}
        <Motion.span
          className="text-5xl"
          role="img"
          aria-label={abandoned ? "Match ended" : copy.title}
          initial={reduced ? false : { scale: 0.3, rotate: outcome === "won" ? -20 : 0, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 14 }}
        >
          {abandoned ? "👋" : copy.emoji}
        </Motion.span>
        <h1 className="font-display text-3xl font-semibold tracking-wide text-ink">
          {abandoned ? (iLeft ? "You left the match" : "Your opponent left") : copy.title}
        </h1>
        <p className="text-sm text-muted">
          {match.gameName} · {abandoned ? "No points were awarded." : copy.sub}
        </p>
      </div>

      {!abandoned && (
        <>
          <div className="ch-scores">
            <BigScore label="Your Score" value={you.score} delay={0.25} strong={outcome === "won"} />
            <BigScore label="Opponent" value={match.totals.opponent.score} delay={0.4} strong={outcome === "lost"} />
          </div>

          {outcome === "won" && match.rewardPoints > 0 && (
            <Motion.span
              className="ch-reward"
              initial={reduced ? false : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 18, delay: reduced ? 0 : 0.8 }}
            >
              +{match.rewardPoints} leaderboard points
            </Motion.span>
          )}
          {outcome === "won" && match.rewardPoints === 0 && (
            <p className="text-xs text-muted">
              {match.rewardWithheld === "opponent_inactive"
                ? "No points this time — your opponent didn't play."
                : "A win needs a positive score to earn leaderboard points."}
            </p>
          )}
          {outcome !== "won" && <p className="text-xs text-muted">Only the winner's score goes to the leaderboard.</p>}

          <div className="grid w-full grid-cols-4 gap-2" aria-label="Your match statistics">
            <Tile label="Correct" value={you.correct} kind="correct" />
            <Tile label="Wrong" value={you.wrong} kind="wrong" />
            <Tile label="Timeout" value={you.timeout} kind="wrong" />
            <Tile label="Final" value={you.score} />
          </div>
        </>
      )}

      {rematch?.status === "declined" && <p className="text-xs font-semibold text-muted">Rematch declined.</p>}
      {rematch?.status === "pending" && rematch.direction === "incoming" && (
        <p className="text-xs font-semibold text-accent">{match.opponent.fullName} wants to play again.</p>
      )}
      {rematch?.status === "pending" && rematch.direction === "outgoing" && (
        <p className="text-xs font-semibold text-muted">Waiting for {match.opponent.fullName} to accept…</p>
      )}
      {flow.actionError && (
        <p role="alert" className="text-xs font-medium text-danger">
          {flow.actionError}
        </p>
      )}

      <div className="flex w-full flex-col gap-2.5">
        {match.results.length > 0 && (
          <FixedButton variant="outline" className="min-h-11 w-full" onClick={() => setReviewing((open) => !open)} aria-expanded={reviewing}>
            <FactCheck fontSize="small" />
            {reviewing ? "Hide review" : "Review answers"}
          </FixedButton>
        )}
        <div className="flex w-full gap-2.5">
          <FixedButton variant="outline" className="min-h-11 min-w-0 flex-1" onClick={onBack}>
            Back to Games
          </FixedButton>
          {outcome &&
            !abandoned &&
            (rematch?.status === "pending" && rematch.direction === "outgoing" ? (
              <FixedButton variant="outline" className="min-h-11 min-w-0 flex-1" loading={flow.acting} onClick={flow.cancelRematch}>
                Cancel request
              </FixedButton>
            ) : (
              <FixedButton
                variant="primary"
                className="min-h-11 min-w-0 flex-1"
                loading={flow.acting}
                disabled={flow.acting || (rematch?.status === "pending" && rematch.direction === "incoming")}
                onClick={flow.requestRematch}
              >
                <Replay fontSize="small" /> Play Again
              </FixedButton>
            ))}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {reviewing && (
          <Motion.div
            className="w-full"
            initial={reduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <ChallengeReview results={match.results} opponentName={match.opponent.fullName} />
          </Motion.div>
        )}
      </AnimatePresence>
    </Motion.div>
  );
}
