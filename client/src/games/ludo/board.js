// GENERATED FILE — do not edit. Source: server/src/games/ludo/board.js
// Regenerate with `npm run sync:ludo` in server/ (see server/scripts/sync-ludo-engine.js).

// Ludo board geometry — pure data and arithmetic, no rules.
//
// A token's position is ONE integer, relative to its own colour:
//
//   -1        in the base (not yet released)
//   0 .. 50   on the shared 52-cell track, 0 being that colour's own start cell
//   51 .. 55  in that colour's private home column (five cells, never shared)
//   56        finished (Home)
//
// The shared track is numbered 0..51 clockwise ("absolute" cells). A colour's
// relative position r on the track sits on absolute cell (start + r) % 52.
// The cell right before a colour's own start is skipped: after relative 50 the
// token turns into its home column.

const TRACK_LENGTH = 52;
const TOKENS_PER_PLAYER = 4;
const LAST_TRACK_REL = 50;
const HOME_COLUMN_LENGTH = 5;
const FIRST_HOME_COLUMN_REL = LAST_TRACK_REL + 1; // 51
const FINISH = FIRST_HOME_COLUMN_REL + HOME_COLUMN_LENGTH; // 56
const IN_BASE = -1;

const SEAT_COUNT = 4;
const SEAT_COLORS = Object.freeze(["red", "green", "yellow", "blue"]);
// Clockwise around the board, 13 cells apart.
const START_CELL = Object.freeze([0, 13, 26, 39]);

// Which seats are used for N players. Two players sit opposite each other.
const SEATS_FOR_PLAYERS = Object.freeze({
  1: [0],
  2: [0, 2],
  3: [0, 1, 2],
  4: [0, 1, 2, 3],
});

// Default safe cells (absolute): every start cell and the "star" cell 8 steps after it.
const DEFAULT_SAFE_CELLS = Object.freeze([0, 8, 13, 21, 26, 34, 39, 47]);

// ---- Positions ------------------------------------------------------------------

const isInBase = (pos) => pos === IN_BASE;
const isFinished = (pos) => pos === FINISH;
const isOnTrack = (pos) => pos >= 0 && pos <= LAST_TRACK_REL;
const isInHomeColumn = (pos) => pos >= FIRST_HOME_COLUMN_REL && pos < FINISH;

// The coarse state of a token: still in the base, on the board, or finished (Home).
const tokenState = (pos) => (isInBase(pos) ? "HOME_BASE" : isFinished(pos) ? "FINISHED" : "ACTIVE");

// The shared-track cell a token stands on, or null (base / home column / finished).
function absoluteCell(seat, pos) {
  if (!isOnTrack(pos)) return null;
  return (START_CELL[seat] + pos) % TRACK_LENGTH;
}

// ---- Drawing coordinates (15 x 15 grid, cell centres) --------------------------------
// The engine never reads these; the UI uses them so the geometry is defined once.

const TRACK_GRID = Object.freeze(
  [
    ...[1, 2, 3, 4, 5].map((c) => [6, c]),
    ...[5, 4, 3, 2, 1, 0].map((r) => [r, 6]),
    [0, 7],
    [0, 8],
    ...[1, 2, 3, 4, 5].map((r) => [r, 8]),
    ...[9, 10, 11, 12, 13, 14].map((c) => [6, c]),
    [7, 14],
    [8, 14],
    ...[13, 12, 11, 10, 9].map((c) => [8, c]),
    ...[9, 10, 11, 12, 13, 14].map((r) => [r, 8]),
    [14, 7],
    [14, 6],
    ...[13, 12, 11, 10, 9].map((r) => [r, 6]),
    ...[5, 4, 3, 2, 1, 0].map((c) => [8, c]),
    [7, 0],
    [6, 0],
  ].map(([row, col]) => Object.freeze({ row, col })),
);

const HOME_COLUMN_GRID = Object.freeze([
  [1, 2, 3, 4, 5].map((c) => ({ row: 7, col: c })), // red, towards the centre from the left
  [1, 2, 3, 4, 5].map((r) => ({ row: r, col: 7 })), // green, from the top
  [13, 12, 11, 10, 9].map((c) => ({ row: 7, col: c })), // yellow, from the right
  [13, 12, 11, 10, 9].map((r) => ({ row: r, col: 7 })), // blue, from the bottom
]);

// Base spots: the four resting places inside each colour's corner.
const BASE_SPOTS = Object.freeze([
  [1.5, 1.5, 1.5, 3.5, 3.5, 1.5, 3.5, 3.5],
  [1.5, 10.5, 1.5, 12.5, 3.5, 10.5, 3.5, 12.5],
  [10.5, 10.5, 10.5, 12.5, 12.5, 10.5, 12.5, 12.5],
  [10.5, 1.5, 10.5, 3.5, 12.5, 1.5, 12.5, 3.5],
].map((flat) => Object.freeze(Array.from({ length: 4 }, (_, i) => ({ row: flat[i * 2], col: flat[i * 2 + 1] })))));

// Where finished tokens rest, just inside the centre, per colour.
const FINISH_SPOTS = Object.freeze([
  [7, 6.35],
  [6.35, 7],
  [7, 7.65],
  [7.65, 7],
].map(([row, col]) => Object.freeze({ row, col })));

// Centre of the cell a token is drawn on: { row, col } in grid units (may be fractional).
function gridPosition(seat, pos, tokenId = 0) {
  if (isInBase(pos)) return { ...BASE_SPOTS[seat][tokenId] };
  if (isFinished(pos)) {
    const spot = FINISH_SPOTS[seat];
    const offset = (tokenId - 1.5) * 0.14;
    return seat % 2 === 0 ? { row: spot.row + offset, col: spot.col } : { row: spot.row, col: spot.col + offset };
  }
  if (isInHomeColumn(pos)) {
    const cell = HOME_COLUMN_GRID[seat][pos - FIRST_HOME_COLUMN_REL];
    return { row: cell.row + 0.5, col: cell.col + 0.5 };
  }
  const cell = TRACK_GRID[absoluteCell(seat, pos)];
  return { row: cell.row + 0.5, col: cell.col + 0.5 };
}

export { TRACK_LENGTH, TOKENS_PER_PLAYER, LAST_TRACK_REL, HOME_COLUMN_LENGTH, FIRST_HOME_COLUMN_REL, FINISH, IN_BASE, SEAT_COUNT, SEAT_COLORS, START_CELL, SEATS_FOR_PLAYERS, DEFAULT_SAFE_CELLS, isInBase, isFinished, isOnTrack, isInHomeColumn, tokenState, absoluteCell, TRACK_GRID, HOME_COLUMN_GRID, BASE_SPOTS, gridPosition };
