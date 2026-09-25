import { PeopleAlt, Timer } from "@mui/icons-material";
import { motion as Motion } from "framer-motion";

import FixedButton from "./FixedButton";

/**
 * A game on the Games landing page. Everything shown comes from the server's
 * catalog entry, so a new game type needs no change here (a game that isn't a
 * question quiz supplies `chips` instead of a question count / timer). Unavailable games
 * (e.g. an English game whose question bank is still empty) render disabled
 * with a "Coming soon" chip. Games that support it also get "Play with Friend".
 */
export default function GameCard({ game, onPlay, onChallenge }) {
  return (
    <div className="game-launch-group">
    <Motion.button
      type="button"
      className="game-launch"
      disabled={!game.available}
      onClick={() => onPlay(game)}
      whileHover={game.available ? { y: -2 } : undefined}
      whileTap={game.available ? { scale: 0.985 } : undefined}
      aria-label={game.available ? `Play ${game.name}` : `${game.name} — coming soon`}
    >
      <span className="game-tile" aria-hidden="true">
        {game.icon}
      </span>

      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-display text-base leading-tight font-semibold text-ink">{game.name}</span>
        <span className="text-xs leading-snug text-muted">{game.description}</span>
      </span>

      <span className="game-launch-meta">
        {game.available ? (
          <>
            <span className="game-chip game-chip--tone">Play</span>
            {game.chips ? (
              game.chips.map((chip) => (
                <span key={chip} className="game-chip">
                  {chip}
                </span>
              ))
            ) : (
              <>
                <span className="game-chip">{game.questionCount} questions</span>
                {game.timeLimitSec && (
                  <span className="game-chip">
                    <Timer style={{ fontSize: 13 }} /> {game.timeLimitSec}s each
                  </span>
                )}
              </>
            )}
          </>
        ) : (
          <span className="game-chip">Coming soon</span>
        )}
      </span>
    </Motion.button>
    {game.supportsChallenge && game.available && onChallenge && (
      <FixedButton
        variant="outline"
        className="game-friend-btn"
        onClick={() => onChallenge(game)}
        aria-label={`Play ${game.name} with a friend`}
      >
        <PeopleAlt fontSize="small" /> Play with Friend
      </FixedButton>
    )}
    </div>
  );
}
