import { useCallback, useEffect, useRef, useState } from "react";

import { ACTION, applyAction, createGame } from "../../../../../games/ludo/engine.js";
import { tokensFromState } from "./useLudoDirector";

// Local Ludo: the SAME rules engine the server runs, driven here instead of over
// the network. Nothing about this mode touches the server or needs an account.
// The game is saved in the browser so a refresh doesn't lose a long match.

const STORAGE_KEY = "kb-ludo-local-game";
export const LOCAL_VARIANT = "LOCAL_CLASSIC";

const randomSeed = () => {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0] || 1;
  } catch {
    return Math.floor(Math.random() * 2 ** 31) + 1;
  }
};

const restore = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved?.variantId === LOCAL_VARIANT && Array.isArray(saved.players) && saved.players.length === 4 && saved.phase !== "FINISHED") return saved;
  } catch {
    /* ignore a corrupt save */
  }
  return null;
};

const persist = (state) => {
  try {
    if (state && state.phase !== "FINISHED") localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
};

export const hasSavedLocalGame = () => restore() !== null;

export default function useLocalLudo(director) {
  const [state, setState] = useState(null);
  const [hint, setHint] = useState("");
  const directorRef = useRef(director);
  useEffect(() => {
    directorRef.current = director;
  });

  const begin = useCallback((names) => {
    const game = createGame({
      variantId: LOCAL_VARIANT,
      players: names.map((name, index) => ({ name: name.trim() || `Player ${index + 1}` })),
      seed: randomSeed(),
      now: Date.now(),
    });
    setState(game);
    setHint("");
    persist(game);
    directorRef.current.snap(game);
    return game;
  }, []);

  const resume = useCallback(() => {
    const saved = restore();
    if (!saved) return null;
    setState(saved);
    directorRef.current.snap(saved);
    return saved;
  }, []);

  const dispatch = useCallback(
    (action, { roll = false } = {}) => {
      if (!state || directorRef.current.busy) return;
      if (roll) directorRef.current.beginRoll();
      const result = applyAction(state, { ...action, seat: state.turnSeat }, { now: Date.now() });
      if (!result.ok) {
        if (roll) directorRef.current.cancelRoll();
        setHint(result.error.message);
        return;
      }
      setHint("");
      setState(result.state);
      persist(result.state);
      directorRef.current.play(result.events, result.state);
    },
    [state],
  );

  const roll = useCallback(() => dispatch({ type: ACTION.ROLL_DICE }, { roll: true }), [dispatch]);
  const pick = useCallback((tokenId) => dispatch({ type: ACTION.SELECT_TOKEN, tokenId }), [dispatch]);
  const quit = useCallback(() => {
    persist(null);
    setState(null);
  }, []);

  return { state, hint, begin, resume, roll, pick, quit, tokens: state ? tokensFromState(state) : [] };
}
