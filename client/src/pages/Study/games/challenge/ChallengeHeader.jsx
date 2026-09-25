import { AnimatePresence, motion as Motion, useReducedMotion } from "framer-motion";

import Avatar from "../../../../components/ui/Avatar";

function Side({ person, label, score, align, answered }) {
  return (
    <div className="ch-side" data-align={align} data-answered={answered ? "true" : "false"}>
      <span className="ch-avatar">
        <Avatar person={person} size="md" />
        <AnimatePresence>
          {answered && (
            <Motion.span
              className="ch-avatar-tick"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              aria-hidden="true"
            >
              ✓
            </Motion.span>
          )}
        </AnimatePresence>
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-ink">{label}</p>
        {/* Keyed on the score so it re-mounts (and pops) whenever it changes. */}
        <Motion.p
          key={score}
          className="ch-score"
          initial={{ scale: 1.5, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          {score}
        </Motion.p>
      </div>
    </div>
  );
}

/**
 * The live scoreboard: both players (avatar, name, score) and, while a question
 * is open, the opponent's status — "Answered" / "Thinking…". Scores are the
 * server's, counted from resolved questions only. Purely presentational.
 */
export default function ChallengeHeader({ match, timer, status }) {
  const reduced = useReducedMotion();
  return (
    <header className="flex flex-col gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="game-tile game-tile--sm" aria-hidden="true">
          {match.gameIcon}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg leading-tight font-semibold text-ink">{match.gameName}</h1>
          <p className="text-xs font-semibold text-muted">
            Friend challenge · Question {Math.min(match.currentIndex + 1, match.total)} / {match.total}
          </p>
        </div>
        {timer}
      </div>

      <div className="ch-versus">
        <Side person={match.you} label="You" score={match.totals.you.score} align="start" answered={match.current?.answered} />
        <span className="ch-vs" aria-hidden="true">
          VS
        </span>
        <Side person={match.opponent} label={match.opponent.fullName} score={match.totals.opponent.score} align="end" answered={match.current?.opponentAnswered} />
      </div>

      <div className="flex min-h-7 justify-center" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {status && (
            <Motion.p
              key={status.key}
              className="ch-status"
              data-tone={status.tone}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              <span className="ch-status-dot" aria-hidden="true" />
              {status.text}
            </Motion.p>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
