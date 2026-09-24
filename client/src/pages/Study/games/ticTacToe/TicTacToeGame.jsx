import { ArrowBackRounded, ErrorOutlined, Replay } from "@mui/icons-material";
import { AnimatePresence, motion as Motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import Avatar from "../../../../components/ui/Avatar";
import ConfirmDialog from "../../../../components/ui/ConfirmDialog";
import { ResourceState } from "../../../../utility/helpers";
import { TIC_TAC_TOE_LOBBY, WIN_POINTS } from "../../../../utility/ticTacToe";
import FixedButton from "../components/FixedButton";
import Board, { Mark } from "./Board";
import { ReactionBar, ReactionBursts } from "./Reactions";
import StatsCard from "./StatsCard";
import useGameReactions from "./useGameReactions";
import useTicTacToeGame from "./useTicTacToeGame";

function PlayerBadge({ person, symbol, label, active, align }) {
  return (
    <div className="ttt-player" data-active={active ? "true" : "false"} data-align={align}>
      <Avatar person={person} size="md" />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-ink">{label}</p>
        <p className="truncate text-[11px] text-muted">{person?.fullName}</p>
      </div>
      <span className={`ttt-symbol ttt-symbol--${symbol.toLowerCase()}`} aria-label={`Plays ${symbol}`}>
        <Mark symbol={symbol} animate={false} />
      </span>
    </div>
  );
}

// What the result panel says, derived only from the server's game state.
function describeResult(game, me, opponent) {
  if (game.status === "won") {
    return game.winnerId === me.id
      ? { kind: "won", emoji: "🏆", title: "You won!", text: `Nicely played against ${opponent.fullName}.` }
      : { kind: "lost", emoji: "😔", title: "You lost", text: `${opponent.fullName} took this one.` };
  }
  if (game.status === "draw") return { kind: "draw", emoji: "🤝", title: "Draw", text: "Nobody scores this round." };
  if (game.status === "abandoned") {
    return game.abandonedBy === me.id
      ? { kind: "left", emoji: "👋", title: "You left the game", text: "No points were awarded." }
      : { kind: "left", emoji: "👋", title: "Your opponent left the game", text: "No points were awarded." };
  }
  return null;
}

/**
 * The live game screen. Route: /study/games/tic-tac-toe/:gameId
 * Every rule is the server's; this shows its state and sends the tapped cell.
 */
export default function TicTacToeGame({ user }) {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const ttt = useTicTacToeGame(gameId, user.id);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const reactions = useGameReactions(gameId, user.id);
  const { game, me, opponent, mySymbol, myTurn } = ttt;

  const toLobby = () => navigate(TIC_TAC_TOE_LOBBY);
  const active = game?.status === "active";
  const result = game && me && opponent ? describeResult(game, me, opponent) : null;
  const outcome = result && result.kind !== "left" ? result.kind : null;
  const rematch = game?.rematch;

  const confirmAndLeave = async () => {
    const left = await ttt.leave();
    setConfirmLeave(false);
    if (left) toLobby();
  };

  return (
    <div className="games-scope mx-auto flex w-full max-w-md min-w-0 flex-col gap-4" data-tone="math">
      <div>
        <button
          type="button"
          onClick={() => (active ? setConfirmLeave(true) : toLobby())}
          className="inline-flex items-center gap-1 rounded-md py-1 pr-2 text-xs font-semibold text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ArrowBackRounded style={{ fontSize: 16 }} /> {active ? "Leave game" : "Tic-Tac-Toe"}
        </button>
      </div>

      <ResourceState loading={ttt.loading} error={ttt.error}>
        {game && me && opponent && (
          <>
            <div className="ttt-versus">
              <PlayerBadge person={me} symbol={mySymbol} label="You" active={active && myTurn} align="start" />
              <span className="ttt-vs" aria-hidden="true">
                VS
              </span>
              <PlayerBadge
                person={opponent}
                symbol={mySymbol === "X" ? "O" : "X"}
                label={opponent.fullName}
                active={active && !myTurn}
                align="end"
              />
              <ReactionBursts items={reactions.items} meId={user.id} />
            </div>

            <div className="flex min-h-9 justify-center" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <Motion.p
                  key={`${game.status}-${myTurn}`}
                  className="ttt-status"
                  data-mine={active && myTurn ? "true" : "false"}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {active && <span className="ttt-status-dot" aria-hidden="true" />}
                  {active
                    ? myTurn
                      ? `Your turn — place your ${mySymbol}`
                      : `Waiting for ${opponent.fullName}…`
                    : result?.title}
                </Motion.p>
              </AnimatePresence>
            </div>

            <Board
              board={game.board}
              winningLine={game.winningLine}
              mySymbol={mySymbol}
              canPlay={myTurn}
              pendingCell={ttt.pendingCell}
              outcome={outcome}
              onPlay={ttt.play}
            />

            <ReactionBar enabled={active} cooling={reactions.cooling} error={reactions.error} onSend={reactions.send} />

            {ttt.moveError && (
              <p role="alert" className="text-center text-xs font-medium text-danger">
                {ttt.moveError}
              </p>
            )}

            {result && (
              <Motion.section
                className="ttt-result"
                data-kind={result.kind}
                initial={reduced ? false : { opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 26, delay: reduced ? 0 : 0.55 }}
              >
                <span className="text-3xl" aria-hidden="true">
                  {result.emoji}
                </span>
                <h2 className="font-display text-xl font-semibold text-ink">{result.title}</h2>
                <p className="text-sm text-muted">{result.text}</p>

                {result.kind === "won" && game.rewardPoints > 0 && (
                  <Motion.span
                    className="ttt-points"
                    initial={reduced ? false : { opacity: 0, scale: 0.6, y: 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 18, delay: reduced ? 0 : 0.9 }}
                  >
                    +{game.rewardPoints || WIN_POINTS} Points
                  </Motion.span>
                )}

                {rematch?.status === "declined" && <p className="text-xs font-semibold text-muted">Rematch declined.</p>}
                {rematch?.status === "pending" && rematch.direction === "incoming" && (
                  <p className="text-xs font-semibold text-accent">{opponent.fullName} wants to play again.</p>
                )}
                {rematch?.status === "pending" && rematch.direction === "outgoing" && (
                  <p className="text-xs font-semibold text-muted">Waiting for {opponent.fullName} to accept…</p>
                )}
                {ttt.actionError && (
                  <p role="alert" className="text-xs font-medium text-danger">
                    {ttt.actionError}
                  </p>
                )}

                <div className="flex w-full gap-2.5 pt-1">
                  <FixedButton variant="outline" className="min-h-11 min-w-0 flex-1" onClick={toLobby}>
                    Back to Games
                  </FixedButton>
                  {game.status !== "abandoned" &&
                    (rematch?.status === "pending" && rematch.direction === "outgoing" ? (
                      <FixedButton variant="outline" className="min-h-11 min-w-0 flex-1" loading={ttt.acting} onClick={ttt.cancelRematch}>
                        Cancel request
                      </FixedButton>
                    ) : (
                      <FixedButton
                        variant="primary"
                        className="min-h-11 min-w-0 flex-1"
                        loading={ttt.acting}
                        disabled={ttt.acting || (rematch?.status === "pending" && rematch.direction === "incoming")}
                        onClick={ttt.requestRematch}
                      >
                        <Replay fontSize="small" /> Play Again
                      </FixedButton>
                    ))}
                </div>
              </Motion.section>
            )}

            <StatsCard stats={ttt.stats} />
          </>
        )}
      </ResourceState>

      {ttt.error && (
        <div className="flex justify-center">
          <FixedButton variant="outline" size="sm" onClick={toLobby}>
            <ErrorOutlined fontSize="small" /> Back to Tic-Tac-Toe
          </FixedButton>
        </div>
      )}

      <ConfirmDialog
        open={confirmLeave}
        title="Leave this game?"
        description="Leaving ends the game right now. Nobody gets any points, and your opponent will be told you left."
        confirmLabel="Leave game"
        cancelLabel="Keep playing"
        variant="danger"
        loading={ttt.acting}
        onConfirm={confirmAndLeave}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
