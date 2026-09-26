import { AnimatePresence, motion as Motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef } from "react";

import Avatar from "../../../../../components/ui/Avatar";
import { SEAT_COLORS } from "../../../../../games/ludo/board.js";
import { tokensHome } from "../../../../../games/ludo/engine.js";
import { getVariant } from "../../../../../games/ludo/variants.js";
import { ludoHaptics, ludoSfx } from "../../../../../utility/ludoSound";
import useServerClock from "../hooks/useServerClock";
import Board from "./Board";
import Dice from "./Dice";

const WARN_SECONDS = [10, 5, 3, 2, 1];
const ordinal = (n) => ["", "1st", "2nd", "3rd", "4th"][n] || `${n}th`;

function PlayerCard({ player, active, isMe, isTurn, local, result }) {
  const color = SEAT_COLORS[player.seat];
  const home = tokensHome(player);
  const gone = player.status === "LEFT";
  const away = !local && !player.connected && !gone;
  const name = player.user?.fullName || player.name;
  return (
    <div className="ludo-player" data-color={color} data-active={active ? "true" : "false"} data-gone={gone ? "true" : "false"} data-testid={`ludo-player-${player.seat}`}>
      {player.user?.id ? (
        <Avatar person={player.user} size="md" />
      ) : (
        <span className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-black text-white" style={{ background: "var(--seat)" }} aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">
          {name}
          {isMe && <span className="ml-1 text-[11px] font-semibold text-muted">(you)</span>}
        </p>
        <p className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="ludo-home-dots" aria-label={`${home} of 4 tokens home`}>
            {[0, 1, 2, 3].map((slot) => (
              <i key={slot} data-on={slot < home ? "true" : "false"} />
            ))}
          </span>
          <span>{player.captures} ✕</span>
          {result ? <strong className="text-ink">{ordinal(result.rank)}</strong> : null}
        </p>
        {(away || gone || isTurn) && (
          <p className="text-[11px] font-semibold" style={{ color: away ? "var(--danger)" : "var(--seat)" }} role="status">
            {gone ? "Left the game" : away ? "Reconnecting…" : isMe ? "Your turn" : "Playing…"}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * The shared game surface for online AND local Ludo: players, turn banner, timer,
 * board, dice and hints. It renders an engine state and reports the player's
 * intentions (roll / tap a token); it never decides a rule. `actingSeat` is the
 * seat the person at this screen may act for (online: their own; local: whoever's
 * turn it is).
 */
export default function LudoTable({ state, director, actingSeat, local = false, offsetMs = 0, pendingRoll = false, pendingKey = null, hint = "", onRoll, onPick, rotation = 0, children, aside, variantId }) {
  const reduced = useReducedMotion();
  const variant = getVariant(variantId || state.variantId);
  const turnPlayer = state.players.find((player) => player.seat === state.turnSeat);
  const finished = state.phase === "FINISHED";
  const myTurn = !finished && actingSeat !== null && state.turnSeat === actingSeat;
  const idle = !director.busy && !pendingRoll && !pendingKey;

  const canRoll = myTurn && state.phase === "ROLL" && idle;
  const movable = useMemo(() => {
    const keys = new Set();
    const targets = new Map();
    if (myTurn && state.phase === "MOVE" && idle) {
      for (const move of state.legal) {
        const key = `${state.turnSeat}:${move.tokenId}`;
        keys.add(key);
        targets.set(key, move);
      }
    }
    return { keys, targets };
  }, [myTurn, state.phase, state.legal, state.turnSeat, idle]);

  // Timer — only while the game is live and the countdown has finished.
  const clock = useServerClock(!finished);
  const timing = !finished && state.rules.turnTimeMs > 0 && state.turnDeadline;
  const remainingMs = timing ? Math.max(0, state.turnDeadline - (clock + offsetMs)) : null;
  const timer = { remainingMs, secondsLeft: remainingMs === null ? null : Math.ceil(remainingMs / 1000) };
  const totalMs = state.rules.turnTimeMs || 1;
  const fraction = timer.remainingMs === null ? 1 : Math.min(1, timer.remainingMs / totalMs);
  const warn = timer.secondsLeft !== null && timer.secondsLeft <= 10;
  const danger = timer.secondsLeft !== null && timer.secondsLeft <= 3;

  const lastWarn = useRef(null);
  useEffect(() => {
    if (timer.secondsLeft === null || !myTurn) return;
    if (WARN_SECONDS.includes(timer.secondsLeft) && lastWarn.current !== `${state.turnNumber}:${timer.secondsLeft}`) {
      lastWarn.current = `${state.turnNumber}:${timer.secondsLeft}`;
      ludoSfx.timerWarn();
      if (timer.secondsLeft <= 5) ludoHaptics.warn();
    }
  }, [timer.secondsLeft, myTurn, state.turnNumber]);

  // "Your Turn" cue: once, when the turn arrives.
  const lastTurn = useRef(null);
  useEffect(() => {
    const key = `${state.turnSeat}:${state.turnNumber}:${state.phase === "ROLL"}`;
    if (finished || lastTurn.current === key) return;
    const first = lastTurn.current === null;
    lastTurn.current = key;
    if (!first && myTurn && state.phase === "ROLL") {
      ludoSfx.turn();
      ludoHaptics.step();
    }
  }, [state.turnSeat, state.turnNumber, state.phase, myTurn, finished]);

  const turnName = turnPlayer?.user?.fullName || turnPlayer?.name || "Player";
  const turnColor = SEAT_COLORS[state.turnSeat];
  const started = !finished && state.startsAt <= clock + offsetMs;

  let status;
  if (finished) status = "Game over";
  else if (!started) status = "Get ready…";
  else if (director.busy) status = "…";
  else if (myTurn && state.phase === "ROLL") status = local ? `${turnName}: roll the dice` : "Roll the dice";
  else if (myTurn && state.phase === "MOVE") status = state.legal.length > 1 ? "Tap a glowing token to move it" : "Tap the glowing token";
  else status = `Waiting for ${turnName}…`;

  return (
    <div className="ludo-frame">
    <div className="ludo-screen ludo-scope" data-layout="game" data-testid="ludo-table" data-variant={variant?.id}>
      <div className="ludo-area-turn">
        <AnimatePresence mode="wait" initial={false}>
          <Motion.div
            key={`${state.turnSeat}-${state.turnNumber}-${myTurn}`}
            data-color={turnColor}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2.5 rounded-2xl border-2 bg-panel px-3 py-2"
            style={{ borderColor: "var(--seat)", boxShadow: "0 0 0 3px color-mix(in srgb, var(--seat) 18%, transparent)" }}
            data-testid="ludo-turn"
          >
            {turnPlayer?.user?.id ? (
              <Avatar person={turnPlayer.user} size="sm" />
            ) : (
              <span className="grid size-8 shrink-0 place-items-center rounded-full text-xs font-black text-white" style={{ background: "var(--seat)" }} aria-hidden="true">
                {turnName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-ink" data-testid="ludo-turn-text">
                {finished ? "Game over" : local ? `${turnName}'s turn` : myTurn ? "Your Turn" : `${turnName}'s Turn`}
              </p>
              <p className="truncate text-[11px] text-muted">{variant?.title}</p>
            </div>
            {timer.secondsLeft !== null && !finished && (
              <span
                className="grid min-w-10 place-items-center rounded-full px-2 py-0.5 text-sm font-black tabular-nums"
                style={{ background: danger ? "var(--danger)" : warn ? "#d98a0b" : "var(--soft)", color: danger || warn ? "#fff" : "var(--ink)" }}
                data-testid="ludo-seconds"
                aria-label={`${timer.secondsLeft} seconds left`}
              >
                {timer.secondsLeft}
              </span>
            )}
          </Motion.div>
        </AnimatePresence>
        {timer.secondsLeft !== null && !finished && (
          <div className="ludo-timer mt-1.5" data-color={turnColor} data-warn={warn ? "true" : "false"} data-danger={danger ? "true" : "false"} aria-hidden="true">
            <span style={{ width: `${fraction * 100}%` }} />
          </div>
        )}
      </div>

      <div className="ludo-area-players">
        <div className="ludo-players" data-testid="ludo-players">
          {state.players.map((player) => (
            <PlayerCard
              key={player.seat}
              player={player}
              active={!finished && player.seat === state.turnSeat}
              isTurn={!finished && player.seat === state.turnSeat}
              isMe={actingSeat === player.seat && !local}
              local={local}
              result={finished ? state.rankings?.find((row) => row.seat === player.seat) : null}
            />
          ))}
        </div>
      </div>

      <div className="ludo-area-main ludo-main">
        <div className="ludo-board-wrap">
          <Board
            tokens={director.tokens}
            movable={movable.keys}
            targets={movable.targets}
            selectedKey={pendingKey}
            safeCells={state.rules.safeCells}
            onPick={(seat, id) => onPick(id)}
            rotation={rotation}
            turnSeat={finished ? null : state.turnSeat}
            effects={director.effects}
            banner={director.banner}
            reduced={director.reduced}
            label={`Ludo board, ${variant?.title || ""}`}
          />
          {children}
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-line bg-panel p-2.5" data-color={turnColor}>
          <Dice
            value={director.dice.value}
            rolling={director.dice.rolling}
            landed={director.dice.landed}
            ready={canRoll}
            disabled={!canRoll}
            onRoll={onRoll}
            color={turnColor}
            size={58}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink" role="status" data-testid="ludo-status">
              {status}
            </p>
            <p className="mt-0.5 text-xs leading-snug text-muted" data-testid="ludo-hint">
              {hint || variant?.description}
            </p>
          </div>
        </div>
      </div>

      {aside && <div className="ludo-area-aside ludo-side">{aside}</div>}
    </div>
    </div>
  );
}
