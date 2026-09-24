import { AnimatePresence, motion as Motion, useReducedMotion } from "framer-motion";

import ReactionIcon from "../../../../components/ui/reactions/ReactionIcons";
import { GAME_REACTIONS } from "../../../../utility/ticTacToe";

// One face for every reaction. haha / sad / angry are the app's shared
// reaction faces; poke is a pointing hand (flipped on the opponent's side so it
// always points across the board).
function Glyph({ type, size, flip }) {
  if (type === "poke") {
    return (
      <span className="ttt-poke" style={{ fontSize: size * 0.8, transform: flip ? "scaleX(-1)" : undefined }} aria-hidden="true">
        👉
      </span>
    );
  }
  return <ReactionIcon type={type} className="block size-full" />;
}

/**
 * The four quick reactions. Compact, in normal flow under the board (never over
 * it), each a comfortable touch target. `enabled` is false once the game ends.
 */
export function ReactionBar({ enabled, cooling, onSend, error }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="ttt-reactions" role="group" aria-label="Send a reaction">
        {GAME_REACTIONS.map((reaction) => (
          <button
            key={reaction.type}
            type="button"
            className="ttt-react-btn"
            disabled={!enabled || cooling}
            aria-label={reaction.label}
            title={reaction.label}
            onClick={() => onSend(reaction.type)}
          >
            <span className="ttt-react-icon">
              <Glyph type={reaction.type} size={22} />
            </span>
            {reaction.text && <span className="ttt-react-text">{reaction.text}</span>}
          </button>
        ))}
      </div>
      {error && (
        <p role="status" className="text-center text-[11px] font-medium text-muted">
          {error}
        </p>
      )}
    </div>
  );
}

// Per-reaction motion. Fast (≈1.5s), transform/opacity only.
function motionFor(type, mine) {
  const dir = mine ? 1 : -1;
  switch (type) {
    case "haha": // pops in, bounces, drifts up, fades
      return {
        animate: { opacity: [0, 1, 1, 1, 0], scale: [0.2, 1.3, 0.95, 1.1, 1], y: [10, -4, 2, -6, -22] },
        transition: { duration: 1.5, times: [0, 0.18, 0.4, 0.6, 1], ease: "easeOut" },
      };
    case "sad": // slow, soft float upward with a little sway
      return {
        animate: { opacity: [0, 1, 1, 0], scale: [0.6, 1, 1, 0.95], y: [12, -4, -16, -30], x: [0, 3, -3, 2] },
        transition: { duration: 1.6, times: [0, 0.25, 0.7, 1], ease: "easeOut" },
      };
    case "angry": // pops, then a short shake
      return {
        animate: { opacity: [0, 1, 1, 1, 0], scale: [0.4, 1.25, 1.1, 1.1, 1], x: [0, 0, -6, 6, -5, 5, -2, 0] },
        transition: { duration: 1.4, times: [0, 0.14, 0.3, 0.4, 0.5, 0.6, 0.7, 1], ease: "easeOut" },
      };
    default: // poke — jabs across the board twice
      return {
        animate: { opacity: [0, 1, 1, 1, 1, 0], scale: [0.6, 1.1, 1, 1.1, 1, 1], x: [-8 * dir, 14 * dir, 0, 14 * dir, 0, 0] },
        transition: { duration: 1.4, times: [0, 0.16, 0.34, 0.5, 0.66, 1], ease: "easeOut" },
      };
  }
}

/**
 * The temporary reactions, shown beside the two player cards. `me` is the
 * viewer's id: mine appear on my side, the opponent's on theirs. Absolutely
 * positioned inside the players row — they can't move the board or take taps.
 * With reduced motion they just fade in and out, without moving.
 */
export function ReactionBursts({ items, meId }) {
  const reduced = useReducedMotion();
  return (
    <div className="ttt-bursts" aria-live="polite">
      <AnimatePresence>
        {items.map((item) => {
          const mine = item.from === meId;
          const spec = reduced
            ? { animate: { opacity: [0, 1, 1, 0] }, transition: { duration: 1.2, times: [0, 0.15, 0.8, 1] } }
            : motionFor(item.type, mine);
          return (
            <Motion.span
              key={item.key}
              className="ttt-burst"
              data-side={mine ? "me" : "them"}
              data-type={item.type}
              style={{ "--slot": item.key % 3 }}
              role="img"
              aria-label={`${mine ? "You" : "Opponent"}: ${item.type}`}
              initial={{ opacity: 0 }}
              animate={spec.animate}
              exit={{ opacity: 0 }}
              transition={spec.transition}
            >
              <span className="ttt-burst-face">
                <Glyph type={item.type} size={30} flip={!mine} />
              </span>
            </Motion.span>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
