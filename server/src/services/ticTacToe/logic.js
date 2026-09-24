// Pure Tic-Tac-Toe rules — no database, no sockets — so the server's
// authority over "who won / is it a draw" is one small, directly testable
// function. The board is 9 cells, index 0–8 left-to-right, top-to-bottom;
// each cell is null, "X" or "O".
const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const CELL_COUNT = 9;
const otherSymbol = (symbol) => (symbol === "X" ? "O" : "X");

// -> { status: "won", winner, line } | { status: "draw" } | { status: "active" }
function evaluateBoard(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { status: "won", winner: board[a], line };
    }
  }
  if (board.every((cell) => cell === "X" || cell === "O")) return { status: "draw" };
  return { status: "active" };
}

const isValidCell = (value) => typeof value === "number" && Number.isInteger(value) && value >= 0 && value < CELL_COUNT;

module.exports = { WIN_LINES, CELL_COUNT, otherSymbol, evaluateBoard, isValidCell };
