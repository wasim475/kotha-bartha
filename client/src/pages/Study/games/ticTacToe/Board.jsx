import { motion as Motion, useReducedMotion } from "framer-motion";

// Marks are drawn as strokes that animate in. Purely visual — the board data
// always comes from the server.
export function Mark({ symbol, ghost = false, animate = true }) {
  const reduced = useReducedMotion();
  const draw = animate && !reduced;
  const stroke = (delay) => ({
    initial: draw ? { pathLength: 0, opacity: 0 } : false,
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration: 0.28, delay, ease: "easeOut" },
  });

  return (
    <svg
      viewBox="0 0 100 100"
      className={`ttt-mark ttt-mark--${symbol.toLowerCase()}${ghost ? " ttt-ghost" : ""}`}
      aria-hidden="true"
      fill="none"
      strokeWidth="9"
      strokeLinecap="round"
      stroke="currentColor"
    >
      {symbol === "X" ? (
        <>
          <Motion.path d="M26 26 L74 74" {...stroke(0)} />
          <Motion.path d="M74 26 L26 74" {...stroke(0.12)} />
        </>
      ) : (
        <Motion.circle cx="50" cy="50" r="26" {...stroke(0)} />
      )}
    </svg>
  );
}

const center = (index) => ({ x: (index % 3) * 100 + 50, y: Math.floor(index / 3) * 100 + 50 });
const cellLabel = (index, value) =>
  `Row ${Math.floor(index / 3) + 1}, column ${(index % 3) + 1}: ${value ? value : "empty"}`;

// A handful of small dots flying outward from the board on a win. Angles and
// distances are fixed (no randomness during render).
const SPARKS = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2 + 0.3;
  const distance = 110 + (i % 3) * 34;
  return { id: i, x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, delay: (i % 4) * 0.04, tone: i % 2 };
});

/**
 * The 3×3 board. `outcome` (won | lost | draw | null) only decides how the
 * board LOOKS — glow, winning line, celebration — never any game state.
 * Cells are large touch targets (the board fills the available width).
 */
export default function Board({ board, winningLine, mySymbol, canPlay, pendingCell, outcome, onPlay }) {
  const reduced = useReducedMotion();
  const line = winningLine?.length === 3 ? [center(winningLine[0]), center(winningLine[2])] : null;

  return (
    <Motion.div
      className="ttt-board"
      data-outcome={outcome || "playing"}
      data-turn={canPlay ? "mine" : "other"}
      animate={outcome === "lost" && !reduced ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
      transition={{ duration: 0.45, ease: "easeInOut" }}
    >
      <div className="ttt-grid" role="grid" aria-label="Tic-Tac-Toe board">
        {board.map((value, index) => {
          const isWinning = winningLine?.includes(index);
          const playable = canPlay && !value && pendingCell === null;
          return (
            <Motion.button
              key={index}
              type="button"
              role="gridcell"
              className="ttt-cell"
              data-playable={playable ? "true" : "false"}
              data-win={isWinning ? "true" : "false"}
              data-pending={pendingCell === index ? "true" : "false"}
              disabled={!playable}
              aria-label={cellLabel(index, value)}
              onClick={() => onPlay(index)}
              whileTap={playable && !reduced ? { scale: 0.93 } : undefined}
              whileHover={playable && !reduced ? { scale: 1.02 } : undefined}
            >
              {value ? (
                <Mark symbol={value} />
              ) : pendingCell === index ? (
                <Mark symbol={mySymbol} ghost animate={false} />
              ) : playable ? (
                <Mark symbol={mySymbol} ghost animate={false} />
              ) : null}
            </Motion.button>
          );
        })}
      </div>

      {line && (
        <svg className="ttt-winline" viewBox="0 0 300 300" aria-hidden="true">
          <Motion.line
            x1={line[0].x}
            y1={line[0].y}
            x2={line[1].x}
            y2={line[1].y}
            stroke="currentColor"
            strokeWidth="11"
            strokeLinecap="round"
            initial={reduced ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.92 }}
            transition={{ duration: 0.5, delay: reduced ? 0 : 0.3, ease: "easeInOut" }}
          />
        </svg>
      )}

      {outcome === "won" && !reduced && (
        <div className="ttt-sparks" aria-hidden="true">
          {SPARKS.map((spark) => (
            <Motion.span
              key={spark.id}
              className="ttt-spark"
              data-tone={spark.tone}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.6 }}
              animate={{ x: spark.x, y: spark.y, opacity: [0, 1, 0], scale: [0.6, 1, 0.4] }}
              transition={{ duration: 1.1, delay: 0.55 + spark.delay, ease: "easeOut" }}
            />
          ))}
        </div>
      )}
    </Motion.div>
  );
}
