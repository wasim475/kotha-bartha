import { AnimatePresence, motion as Motion } from "framer-motion";
import { memo, useMemo } from "react";

import { BASE_SPOTS, HOME_COLUMN_GRID, SEAT_COLORS, START_CELL, TRACK_GRID, gridPosition } from "../../../../../games/ludo/board.js";

const SIZE = 15;

// Rotates a point (in 0..15 board units) a number of clockwise quarter turns,
// so the viewer's own colour can always sit at the bottom-left.
function rotatePoint(point, turns) {
  let { row, col } = point;
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) [row, col] = [col, SIZE - row];
  return { row, col };
}

const percent = (value) => `${(value / SIZE) * 100}%`;
const boxPosition = (point) => ({ x: `${(point.col - 0.5) * 100}%`, y: `${(point.row - 0.5) * 100}%` });

const STAR = "M0,-0.34 L0.1,-0.1 L0.34,-0.1 L0.15,0.06 L0.22,0.3 L0,0.16 L-0.22,0.3 L-0.15,0.06 L-0.34,-0.1 L-0.1,-0.1 Z";

// The static board: drawn once, never re-rendered while tokens move.
const BoardArt = memo(function BoardArt({ rotation, safeCells }) {
  const color = (seat) => `var(--ludo-${SEAT_COLORS[seat]})`;
  const soft = (seat) => `var(--ludo-${SEAT_COLORS[seat]}-soft)`;
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" focusable="false">
      <g transform={`rotate(${rotation * 90} ${SIZE / 2} ${SIZE / 2})`}>
        {/* Corner bases */}
        {[0, 1, 2, 3].map((seat) => {
          const row = seat === 0 || seat === 1 ? 0 : 9;
          const col = seat === 0 || seat === 3 ? 0 : 9;
          return (
            <g key={seat}>
              <rect x={col} y={row} width="6" height="6" fill={color(seat)} />
              <rect x={col + 1} y={row + 1} width="4" height="4" rx="0.5" fill="var(--ludo-cell)" />
              {BASE_SPOTS[seat].map((spot, index) => (
                <circle key={index} cx={spot.col} cy={spot.row} r="0.52" fill={soft(seat)} stroke={color(seat)} strokeWidth="0.06" />
              ))}
            </g>
          );
        })}

        {/* Shared track */}
        {TRACK_GRID.map((cell, index) => {
          const startSeat = START_CELL.indexOf(index);
          return (
            <g key={index}>
              <rect x={cell.col} y={cell.row} width="1" height="1" fill={startSeat >= 0 ? color(startSeat) : "var(--ludo-cell)"} stroke="var(--ludo-grid)" strokeWidth="0.04" />
              {safeCells.includes(index) && startSeat < 0 && <path d={STAR} transform={`translate(${cell.col + 0.5} ${cell.row + 0.5})`} fill="var(--ludo-grid)" />}
              {startSeat >= 0 && <path d={STAR} transform={`translate(${cell.col + 0.5} ${cell.row + 0.5})`} fill="rgba(255,255,255,0.85)" />}
            </g>
          );
        })}

        {/* Home columns */}
        {HOME_COLUMN_GRID.map((cells, seat) =>
          cells.map((cell, index) => <rect key={`${seat}-${index}`} x={cell.col} y={cell.row} width="1" height="1" fill={color(seat)} opacity={0.55 + index * 0.09} stroke="var(--ludo-grid)" strokeWidth="0.04" />),
        )}

        {/* Centre: four triangles meeting at the middle */}
        <polygon points="6,6 6,9 7.5,7.5" fill={color(0)} />
        <polygon points="6,6 9,6 7.5,7.5" fill={color(1)} />
        <polygon points="9,6 9,9 7.5,7.5" fill={color(2)} />
        <polygon points="6,9 9,9 7.5,7.5" fill={color(3)} />
        <rect x="6" y="6" width="3" height="3" fill="none" stroke="var(--ludo-grid)" strokeWidth="0.04" />
      </g>
    </svg>
  );
});

// Tokens that share a cell are nudged apart so every one stays visible and tappable.
function stackOffsets(tokens, rotation) {
  const groups = new Map();
  const placed = tokens.map((token) => {
    const point = rotatePoint(gridPosition(token.seat, token.pos, token.id), rotation);
    const key = token.pos < 0 || token.pos === 56 ? `${token.seat}:${token.id}` : `${Math.round(point.row * 2)}:${Math.round(point.col * 2)}`;
    (groups.get(key) || groups.set(key, []).get(key)).push(token.key);
    return { ...token, point, groupKey: key };
  });
  const OFFSETS = [[0, 0], [-0.16, -0.16], [0.16, 0.16], [-0.16, 0.16], [0.16, -0.16], [0, -0.22]];
  return placed.map((token) => {
    const group = groups.get(token.groupKey);
    if (group.length === 1) return token;
    const [dRow, dCol] = OFFSETS[Math.min(group.indexOf(token.key), OFFSETS.length - 1)];
    return { ...token, point: { row: token.point.row + dRow, col: token.point.col + dCol } };
  });
}

/**
 * The Ludo board. It draws what it is given: token positions (already the
 * director's animated ones), which tokens can be tapped, where they would land.
 * It decides nothing.
 */
export default function Board({ tokens, movable, targets, selectedKey, onPick, safeCells = [], rotation = 0, turnSeat = null, effects = [], banner = null, reduced = false, label = "Ludo board" }) {
  const placed = useMemo(() => stackOffsets(tokens, rotation), [tokens, rotation]);
  const targetList = useMemo(
    () => [...targets.entries()].map(([key, move]) => {
      const [seat, id] = key.split(":").map(Number);
      return { key, seat, id, move, point: rotatePoint(gridPosition(seat, move.to, id), rotation) };
    }),
    [targets, rotation],
  );
  const hop = !reduced;
  // The star cells come from the game's own rules (never a copy in the UI); memoised by value so the static art isn't redrawn on every update.
  const safeKey = safeCells.join(",");
  const safe = useMemo(() => safeCells, [safeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="ludo-board" role="group" aria-label={label}>
      <BoardArt rotation={rotation} safeCells={safe} />

      <div className="ludo-layer">
        {/* Where each tappable token would land — valid-move highlighting. */}
        {targetList.map(({ key, seat, point, move }) => (
          <div key={`t-${key}`} className="ludo-token-box" data-color={SEAT_COLORS[seat]} style={{ transform: `translate(${boxPosition(point).x}, ${boxPosition(point).y})` }}>
            <span className="ludo-target" data-hot={selectedKey === key ? "true" : "false"} title={move.captures.length ? "Captures a token" : undefined} />
          </div>
        ))}

        {placed.map((token) => {
          const isMovable = movable.has(token.key);
          const move = targets.get(token.key);
          const seatColor = SEAT_COLORS[token.seat];
          return (
            <Motion.div
              key={token.key}
              className="ludo-token-box"
              data-color={seatColor}
              initial={false}
              animate={boxPosition(token.point)}
              transition={reduced ? { duration: 0 } : { type: "tween", ease: "easeInOut", duration: token.moveMs ? token.moveMs / 1000 : 0.14 }}
              style={{ zIndex: isMovable ? 4 : token.seat === turnSeat ? 2 : 1, pointerEvents: "none" }}
            >
              <Motion.button
                type="button"
                className="ludo-token"
                data-movable={isMovable ? "true" : "false"}
                data-selected={selectedKey === token.key ? "true" : "false"}
                disabled={!isMovable}
                tabIndex={isMovable ? 0 : -1}
                aria-label={
                  isMovable
                    ? `Move ${seatColor} token ${token.id + 1}${move?.captures?.length ? " and capture" : ""}${move?.kind === "HOME" ? " into Home" : move?.kind === "EXIT" ? " out of the base" : ""}`
                    : `${seatColor} token ${token.id + 1}`
                }
                onClick={() => isMovable && onPick(token.seat, token.id)}
                key={`${token.key}:${token.pos}`}
                animate={hop && token.pos >= 0 && token.stepping ? { y: ["0%", "-22%", "0%"] } : { y: "0%" }}
                transition={{ duration: 0.14 }}
              >
                {isMovable && <span className="ludo-token-tap" aria-hidden="true" />}
                <span className="ludo-token-num" aria-hidden="true">{token.id + 1}</span>
              </Motion.button>
            </Motion.div>
          );
        })}

        <AnimatePresence>
          {effects.map((effect) => (
            <Effect key={effect.id} effect={effect} rotation={rotation} reduced={reduced} />
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {banner && (
          <Motion.div
            key={banner.id}
            className="ludo-banner"
            role="status"
            initial={reduced ? { opacity: 0, x: "-50%", y: "-50%" } : { opacity: 0, scale: 0.7, x: "-50%", y: "-50%" }}
            animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
            exit={{ opacity: 0, x: "-50%", y: "-50%" }}
            transition={{ duration: 0.18 }}
          >
            {banner.text}
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// A short-lived burst at a cell (capture, exit, arriving Home).
function Effect({ effect, rotation, reduced }) {
  const point = rotatePoint({ row: effect.row, col: effect.col }, rotation);
  const style = { left: percent(point.col), top: percent(point.row), width: percent(1), height: percent(1), transform: "translate(-50%, -50%)" };
  if (reduced) {
    return (
      <Motion.span className="ludo-effect" style={style} initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
        <span className="block size-full rounded-full" style={{ background: `var(--ludo-${effect.color || "red"})`, opacity: 0.6 }} />
      </Motion.span>
    );
  }
  if (effect.kind === "trail") {
    return (
      <Motion.span className="ludo-effect" style={style} initial={{ opacity: 0.7, scale: 0.9 }} animate={{ opacity: 0, scale: 1.7 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease: "easeOut" }}>
        <span className="absolute inset-[28%] rounded-full" style={{ background: `var(--ludo-${effect.color || "red"})`, opacity: 0.55 }} />
      </Motion.span>
    );
  }
  const count = effect.kind === "capture" ? 12 : 8;
  return (
    <Motion.span className="ludo-effect" style={style} initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Motion.span
        className="absolute inset-0 rounded-full"
        style={{ border: `3px solid var(--ludo-${effect.color || "red"})` }}
        initial={{ scale: 0.3, opacity: 0.9 }}
        animate={{ scale: effect.kind === "capture" ? 3.2 : 2.2, opacity: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      {Array.from({ length: count }, (_, index) => {
        const angle = (index / count) * Math.PI * 2;
        const distance = effect.kind === "capture" ? 2.6 : 1.7;
        return (
          <Motion.span
            key={index}
            className="absolute top-1/2 left-1/2 block rounded-full"
            style={{ width: "26%", height: "26%", marginLeft: "-13%", marginTop: "-13%", background: `var(--ludo-${effect.color || "red"})` }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: `${Math.cos(angle) * distance * 100}%`, y: `${Math.sin(angle) * distance * 100}%`, opacity: 0, scale: 0.2 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
          />
        );
      })}
    </Motion.span>
  );
}
