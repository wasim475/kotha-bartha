import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import { SEAT_COLORS, START_CELL, TRACK_GRID, gridPosition } from "../../../../../games/ludo/board.js";
import { ludoHaptics, ludoSfx } from "../../../../../utility/ludoSound";

// The animation director. Authoritative game state comes from the server (online)
// or the engine (local) as { events, state }; this turns the events into a short,
// ordered show — dice tumble, step-by-step token movement, capture bursts — and
// then ALWAYS settles on the authoritative token positions. It never changes the
// game: a stuck or skipped animation can only make things look different for a
// moment, never wrong. If updates pile up (a slow tab) it skips the show and snaps.

const ROLL_MS = 650;
const STEP_MS = 150;
const EXIT_MS = 340;
const CAPTURE_MS = 620;
const BANNER_MS = 1300;
const MAX_QUEUE = 3;

const ordinal = (n) => ["", "1st", "2nd", "3rd", "4th"][n] || `${n}th`;

export function tokensFromState(state) {
  return state.players
    .filter((player) => player.status !== "LEFT")
    .flatMap((player) =>
      player.tokens.map((token) => ({ key: `${player.seat}:${token.id}`, seat: player.seat, id: token.id, pos: token.pos, moveMs: 0, stepping: false })),
    );
}

export default function useLudoDirector() {
  const reduced = useReducedMotion();
  const [tokens, setTokens] = useState([]);
  const [dice, setDice] = useState({ value: null, rolling: false, landed: false });
  const [banner, setBanner] = useState(null);
  const [effects, setEffects] = useState([]);
  const [busyCount, setBusyCount] = useState(0);

  const alive = useRef(true);
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);
  const rollStartedAt = useRef(null);
  const counter = useRef(0);
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const wait = useCallback(
    (ms) =>
      new Promise((resolve) => {
        if (!alive.current) return resolve();
        setTimeout(resolve, reducedRef.current ? Math.min(ms, 40) : ms);
      }),
    [],
  );

  const showBanner = useCallback((text) => {
    const id = ++counter.current;
    setBanner({ id, text });
    setTimeout(() => setBanner((current) => (current?.id === id ? null : current)), BANNER_MS);
  }, []);

  const addEffect = useCallback((effect) => {
    const id = ++counter.current;
    setEffects((current) => [...current.slice(-6), { ...effect, id }]);
    setTimeout(() => setEffects((current) => current.filter((item) => item.id !== id)), 900);
  }, []);

  const patchToken = useCallback((key, patch) => setTokens((current) => current.map((token) => (token.key === key ? { ...token, ...patch } : token))), []);

  const runEvents = useCallback(
    async (events, state) => {
      const nameOf = (seat) => state.players.find((player) => player.seat === seat)?.user?.fullName || state.players.find((player) => player.seat === seat)?.name || "Player";
      for (const event of events) {
        if (!alive.current) return;
        switch (event.type) {
          case "DICE_ROLLED": {
            const started = rollStartedAt.current;
            rollStartedAt.current = null;
            setDice({ value: event.value, rolling: true, landed: false });
            if (!started) ludoSfx.diceRoll();
            await wait(Math.max(0, ROLL_MS - (started ? Date.now() - started : 0)));
            setDice({ value: event.value, rolling: false, landed: true });
            ludoSfx.diceLand();
            ludoHaptics.dice();
            await wait(360);
            setDice((current) => ({ ...current, landed: false }));
            break;
          }
          case "TOKEN_EXITED_HOME": {
            const key = `${event.seat}:${event.tokenId}`;
            patchToken(key, { pos: event.to, moveMs: EXIT_MS, stepping: false });
            ludoSfx.exit();
            const cell = TRACK_GRID[START_CELL[event.seat]];
            addEffect({ kind: "exit", row: cell.row + 0.5, col: cell.col + 0.5, color: SEAT_COLORS[event.seat] });
            await wait(EXIT_MS + 30);
            break;
          }
          case "TOKEN_MOVED": {
            const key = `${event.seat}:${event.tokenId}`;
            if (reducedRef.current) {
              patchToken(key, { pos: event.to, moveMs: 0, stepping: false });
              await wait(40);
              break;
            }
            let previous = event.from;
            for (const pos of event.path) {
              if (!alive.current) return;
              const trail = gridPosition(event.seat, previous, event.tokenId);
              addEffect({ kind: "trail", row: trail.row, col: trail.col, color: SEAT_COLORS[event.seat] });
              previous = pos;
              patchToken(key, { pos, moveMs: STEP_MS, stepping: true });
              ludoSfx.step();
              ludoHaptics.step();
              await wait(STEP_MS + 10);
            }
            patchToken(key, { stepping: false });
            break;
          }
          case "TOKEN_CAPTURED": {
            const cell = TRACK_GRID[event.cell];
            addEffect({ kind: "capture", row: cell.row + 0.5, col: cell.col + 0.5, color: SEAT_COLORS[event.victimSeat] });
            patchToken(`${event.victimSeat}:${event.victimTokenId}`, { pos: -1, moveMs: CAPTURE_MS - 80, stepping: false });
            showBanner(`${nameOf(event.by)} captured ${nameOf(event.victimSeat)}!`);
            ludoSfx.capture();
            ludoHaptics.capture();
            await wait(CAPTURE_MS);
            break;
          }
          case "TOKEN_FINISHED": {
            const spot = gridPosition(event.seat, 56, event.tokenId);
            addEffect({ kind: "home", row: spot.row, col: spot.col, color: SEAT_COLORS[event.seat] });
            ludoSfx.home();
            await wait(320);
            break;
          }
          case "EXTRA_TURN":
            showBanner(event.reason === "SIX" ? "Six! Roll again" : event.reason === "CAPTURE" ? "Capture bonus — roll again" : "Home bonus — roll again");
            await wait(240);
            break;
          case "NO_MOVES":
            showBanner("No move possible");
            await wait(650);
            break;
          case "SIXES_LIMIT":
            showBanner("Too many sixes — turn lost");
            await wait(650);
            break;
          case "TIMEOUT":
            showBanner(`${nameOf(event.seat)} ran out of time`);
            await wait(450);
            break;
          case "PLAYER_FINISHED":
            if (event.rank) showBanner(`${nameOf(event.seat)} finished ${ordinal(event.rank)}!`);
            else showBanner(`${nameOf(event.seat)} has all tokens Home`);
            ludoSfx.achievement();
            await wait(600);
            break;
          case "PLAYER_LEFT":
            showBanner(`${nameOf(event.seat)} left the game`);
            await wait(400);
            break;
          default:
            break;
        }
      }
    },
    [addEffect, patchToken, showBanner, wait],
  );

  // Animate an update, then settle on the authoritative positions.
  const play = useCallback(
    (events, state) => {
      pending.current += 1;
      setBusyCount((count) => count + 1);
      const skip = pending.current > MAX_QUEUE || !events?.length;
      queue.current = queue.current.then(async () => {
        try {
          if (!skip) await runEvents(events, state);
        } catch {
          /* animation trouble never affects the game */
        } finally {
          pending.current = Math.max(0, pending.current - 1);
          if (alive.current) {
            setTokens(tokensFromState(state));
            setBusyCount((count) => Math.max(0, count - 1));
          }
        }
      });
    },
    [runEvents],
  );

  // Show a state as is (first load, reconnect, resync): no animation.
  const snap = useCallback((state) => {
    setTokens(tokensFromState(state));
    setDice((current) => ({ value: state.dice ?? current.value, rolling: false, landed: false }));
  }, []);

  // My own click: start tumbling now, the result decides where it lands.
  const beginRoll = useCallback(() => {
    rollStartedAt.current = Date.now();
    setDice((current) => ({ value: current.value, rolling: true, landed: false }));
    ludoSfx.diceRoll();
  }, []);

  const cancelRoll = useCallback(() => {
    if (rollStartedAt.current === null) return;
    rollStartedAt.current = null;
    setDice((current) => ({ ...current, rolling: false }));
  }, []);

  return { tokens, dice, banner, effects, busy: busyCount > 0, reduced: Boolean(reduced), play, snap, beginRoll, cancelRoll };
}
