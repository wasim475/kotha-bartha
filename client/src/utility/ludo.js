import { api } from "./api";
import { realtime } from "./helpers";

// Client helpers for online Ludo. Every rule — who may invite whom, whose turn
// it is, the dice, where a token lands, captures, the winner, rewards — lives on
// the server (and in the shared engine); these are thin wrappers that call it
// and surface its answer.

export const LUDO_EVENTS = [
  "ludo:invite",
  "ludo:invite:accepted",
  "ludo:invite:declined",
  "ludo:invite:cancelled",
  "ludo:invite:expired",
  "ludo:rematch",
  "ludo:rematch:accepted",
  "ludo:rematch:declined",
  "ludo:rematch:cancelled",
  "ludo:rematch:expired",
  "ludo:lobby",
  "ludo:lobby:closed",
  "ludo:started",
  "ludo:state",
  "ludo:roll",
  "ludo:move",
  "ludo:capture",
  "ludo:turn",
  "ludo:timer",
  "ludo:finished",
  "ludo:takeover",
  "ludo:joined",
  "ludo:chat",
  "ludo:reaction",
];

export const LUDO_HOME = "/study/games/ludo";
export const ludoLobbyPath = (gameId) => `${LUDO_HOME}/lobby/${gameId}`;
export const ludoPlayPath = (gameId) => `${LUDO_HOME}/play/${gameId}`;
export const LUDO_LOCAL_PATH = `${LUDO_HOME}/local`;
export const LUDO_HISTORY_PATH = `${LUDO_HOME}/history`;

export const apiErrorMessage = (error, fallback = "Something went wrong.") => error?.response?.data?.error?.message || error?.message || fallback;

// The in-game quick reactions (the server accepts only these ids).
export const LUDO_REACTIONS = [
  { type: "haha", emoji: "😂", label: "Haha" },
  { type: "goodmove", emoji: "👏", label: "Good move!" },
  { type: "nice", emoji: "😎", label: "Nice!" },
  { type: "great", emoji: "🔥", label: "Great!" },
  { type: "oops", emoji: "😢", label: "Oops!" },
  { type: "hi", emoji: "👋", label: "Hi" },
];

// A small message shown by the global host (a toast), from anywhere.
export function showLudoNotice(message, tone = "info") {
  realtime.dispatchEvent(new CustomEvent("ludo:notice", { detail: { message, tone } }));
}

// Lobby + invite calls -------------------------------------------------------------------

export async function createLobby(input) {
  const { data } = await api.post("/games/ludo/lobbies", input);
  return data.data.game;
}

// Returns true if an invitation was sent; rejections come straight from the server.
export async function inviteToLobby(gameId, person) {
  try {
    await api.post("/games/ludo/invites", { gameId, userId: person.id });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error, "Couldn't send the invitation.") };
  }
}

// Variant catalog, fetched once and shared.
let catalogPromise = null;
export function loadLudoCatalog() {
  if (!catalogPromise) {
    catalogPromise = api
      .get("/games/ludo/variants")
      .then(({ data }) => data.data)
      .catch((error) => {
        catalogPromise = null;
        throw error;
      });
  }
  return catalogPromise;
}
