import { api } from "./api";
import { realtime } from "./helpers";

// Client helpers for friend-vs-friend Tic-Tac-Toe. Every rule (who may invite
// whom, whose turn it is, who won, points) lives on the server — these are
// thin wrappers that call it and surface its answer.

export const TTT_EVENTS = [
  "ticTacToe:invite",
  "ticTacToe:invite:accepted",
  "ticTacToe:invite:declined",
  "ticTacToe:invite:cancelled",
  "ticTacToe:invite:expired",
  "ticTacToe:rematch",
  "ticTacToe:rematch:accepted",
  "ticTacToe:rematch:declined",
  "ticTacToe:rematch:cancelled",
  "ticTacToe:rematch:expired",
  "ticTacToe:joined",
  "ticTacToe:state",
  "ticTacToe:move",
  "ticTacToe:finished",
  "ticTacToe:player:left",
];

export const WIN_POINTS = 20;
export const ticTacToeGamePath = (gameId) => `/study/games/tic-tac-toe/${gameId}`;
export const TIC_TAC_TOE_LOBBY = "/study/games/tic-tac-toe";

export const apiErrorMessage = (error, fallback = "Something went wrong.") =>
  error.response?.data?.error?.message || fallback;

// A small message shown by the global host (a toast), from anywhere.
export function showTicTacToeNotice(message, tone = "info") {
  realtime.dispatchEvent(new CustomEvent("ticTacToe:notice", { detail: { message, tone } }));
}

// "Play Tic-Tac-Toe" from a friend's profile / friend list / the lobby.
// Returns true if an invitation was sent. Rejections (not friends, blocked,
// they turned game requests off, already pending…) come straight from the
// server and are shown as a notice; an already-running game just opens.
export async function inviteFriend(person, { navigate } = {}) {
  try {
    await api.post("/games/tic-tac-toe/invites", { userId: person.id });
    showTicTacToeNotice(`Invitation sent to ${person.fullName}.`, "success");
    return true;
  } catch (error) {
    const body = error.response?.data?.error;
    if (body?.code === "GAME_IN_PROGRESS" && body.gameId && navigate) {
      navigate(ticTacToeGamePath(body.gameId));
      return false;
    }
    showTicTacToeNotice(apiErrorMessage(error, "Couldn't send the invitation."), "error");
    return false;
  }
}
