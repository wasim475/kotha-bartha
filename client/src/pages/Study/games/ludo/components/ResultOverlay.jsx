import { HistoryRounded, Logout, Replay } from "@mui/icons-material";
import { motion as Motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";

import Avatar from "../../../../../components/ui/Avatar";
import { SEAT_COLORS } from "../../../../../games/ludo/board.js";
import { ludoHaptics, ludoSfx } from "../../../../../utility/ludoSound";
import FixedButton from "../../components/FixedButton";
import Celebration from "./Celebration";

const ordinal = (n) => ["", "1st", "2nd", "3rd", "4th"][n] || `${n}th`;
const RESULT_LABEL = { WIN: "Winner", LOSS: "Defeated", FINISHED: "Finished", FORFEIT: "Left the game", DRAW: "Draw" };
const REASON_NOTE = {
  FORFEIT: "The match ended because the other players left, so no rewards were given.",
  DRAW: "Nobody won this match.",
};

const duration = (seconds) => (typeof seconds === "number" ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : null);

/**
 * The result of a finished match, for the online AND local modes. `rows` are
 * plain result rows — { seat, rank, result, name, user?, captures, tokensHome,
 * rewardPoints?, rewardXp? } — built by the caller from server results (online)
 * or the engine's rankings (local). Nothing here is computed.
 */
export default function ResultOverlay({ rows, mySeat = null, local = false, reason, durationSec, rankingEnabled, onPlayAgain, playAgainLabel = "Play Again", playAgainBusy = false, onHistory, onExit, rematchNote = "", error = "" }) {
  const reduced = useReducedMotion();
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  const winner = sorted.find((row) => row.rank === 1 && row.result !== "DRAW");
  const me = mySeat === null ? null : rows.find((row) => row.seat === mySeat);
  const iWon = Boolean(me && winner && me.seat === winner.seat);
  const drawn = sorted.every((row) => row.result === "DRAW");

  useEffect(() => {
    if (iWon || (local && winner)) {
      ludoSfx.win();
      ludoHaptics.win();
    } else if (!drawn) {
      ludoSfx.lose();
    }
  }, [iWon, local, winner, drawn]);

  let title;
  let subtitle;
  if (drawn) {
    title = "It's a draw";
    subtitle = "Nobody won this one.";
  } else if (local) {
    title = `${winner?.name} wins!`;
    subtitle = rankingEnabled ? "Final standings below." : "Well played, everyone.";
  } else if (iWon) {
    title = rankingEnabled ? "You finished 1st!" : "You won!";
    subtitle = "A fantastic match.";
  } else if (me?.result === "FORFEIT") {
    title = "You left the match";
    subtitle = "No rewards for a match you left.";
  } else {
    title = rankingEnabled && me ? `You finished ${ordinal(me.rank)}` : "Good game!";
    subtitle = `${winner?.name || "Your opponent"} took this one — rematch?`;
  }
  const celebrate = (iWon || (local && Boolean(winner))) && !reduced;

  return (
    <div className="ludo-overlay ludo-scope" role="dialog" aria-modal="true" aria-label={title} data-testid="ludo-result">
      {celebrate && <Celebration />}
      <Motion.div
        className="ludo-result"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
      >
        <div className="flex flex-col items-center gap-2 px-5 pt-6 pb-3 text-center" style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--accent) 14%, transparent), transparent)" }}>
          <Motion.div initial={reduced ? false : { scale: 0.2, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.1 }} className="relative">
            {winner?.user?.id ? <Avatar person={winner.user} size="xl" /> : <span className="grid size-20 place-items-center rounded-full text-3xl font-black text-white" style={{ background: `var(--ludo-${SEAT_COLORS[winner?.seat ?? 0]})` }}>{(winner?.name || "?").slice(0, 1).toUpperCase()}</span>}
            {!drawn && winner && <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-3xl" aria-hidden="true">👑</span>}
          </Motion.div>
          <h2 className="font-display text-2xl leading-tight font-semibold text-ink" data-testid="ludo-result-title">{title}</h2>
          <p className="text-sm text-muted">{subtitle}</p>
          {(duration(durationSec) || reason) && (
            <p className="text-xs text-muted">
              {duration(durationSec) && <>Match length {duration(durationSec)}</>}
            </p>
          )}
        </div>

        <ul className="flex flex-col gap-2 px-4 pb-3" data-testid="ludo-result-rows">
          {sorted.map((row, index) => (
            <Motion.li
              key={row.seat}
              data-color={SEAT_COLORS[row.seat]}
              initial={reduced ? false : { opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + index * 0.08 }}
              className="flex items-center gap-2.5 rounded-xl border bg-soft/50 p-2"
              style={{ borderColor: row.seat === mySeat ? "var(--seat)" : "var(--line)", borderLeft: "5px solid var(--seat)" }}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-panel text-xs font-black text-ink" aria-label={`Place ${row.rank}`}>
                {row.result === "DRAW" ? "=" : ordinal(row.rank)}
              </span>
              {row.user?.id ? <Avatar person={row.user} size="sm" /> : <span className="grid size-8 shrink-0 place-items-center rounded-full text-xs font-black text-white" style={{ background: "var(--seat)" }}>{row.name.slice(0, 1).toUpperCase()}</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">
                  {row.name}
                  {row.seat === mySeat && <span className="ml-1 text-[11px] font-semibold text-muted">(you)</span>}
                </p>
                <p className="text-[11px] text-muted">
                  {RESULT_LABEL[row.result] || row.result} · {row.captures} captured · {row.tokensHome}/4 home
                </p>
              </div>
              {(row.rewardPoints > 0 || row.rewardXp > 0) && (
                <span className="shrink-0 text-right text-[11px] leading-tight font-bold text-ink" data-testid="ludo-reward">
                  {row.rewardPoints > 0 && <span className="block">+{row.rewardPoints} pts</span>}
                  {row.rewardXp > 0 && <span className="block text-muted">+{row.rewardXp} XP</span>}
                </span>
              )}
            </Motion.li>
          ))}
        </ul>

        {REASON_NOTE[reason] && <p className="px-5 pb-2 text-center text-xs text-muted">{REASON_NOTE[reason]}</p>}
        {rematchNote && <p className="px-5 pb-2 text-center text-xs font-semibold text-ink" role="status" data-testid="ludo-rematch-note">{rematchNote}</p>}
        {error && <p className="px-5 pb-2 text-center text-xs font-medium text-danger" role="alert">{error}</p>}

        <div className="flex flex-wrap gap-2 px-4 pt-1 pb-5">
          {onPlayAgain && (
            <FixedButton variant="primary" size="md" className="min-h-11 min-w-[7.5rem] flex-1" loading={playAgainBusy} onClick={onPlayAgain} data-testid="ludo-play-again">
              <Replay fontSize="small" /> {playAgainLabel}
            </FixedButton>
          )}
          {onHistory && (
            <FixedButton variant="outline" size="md" className="min-h-11 min-w-[7.5rem] flex-1" onClick={onHistory}>
              <HistoryRounded fontSize="small" /> Match History
            </FixedButton>
          )}
          <FixedButton variant="outline" size="md" className="min-h-11 min-w-[7.5rem] flex-1" onClick={onExit} data-testid="ludo-exit">
            <Logout fontSize="small" /> Exit
          </FixedButton>
        </div>
      </Motion.div>
    </div>
  );
}
