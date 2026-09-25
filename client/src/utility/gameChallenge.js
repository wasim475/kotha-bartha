import { realtime } from "./helpers";

// Client helpers for friend quiz challenges (Math / English head-to-head).
// Every rule — who may challenge whom, timing, correctness, scores, the winner
// and the leaderboard reward — lives on the server; these are thin wrappers
// that call it and surface its answer.

export const GC_EVENTS = [
  "gameChallenge:invite",
  "gameChallenge:accepted",
  "gameChallenge:declined",
  "gameChallenge:cancelled",
  "gameChallenge:expired",
  "gameChallenge:rematch",
  "gameChallenge:rematchAccepted",
  "gameChallenge:rematchDeclined",
  "gameChallenge:rematchCancelled",
  "gameChallenge:rematchExpired",
  "gameChallenge:started",
  "gameChallenge:question",
  "gameChallenge:answer",
  "gameChallenge:questionResult",
  "gameChallenge:finished",
  "gameChallenge:player:left",
  "gameChallenge:joined",
];

export const challengeMatchPath = (matchId) => `/study/games/challenge/${matchId}`;
export const onChallengeScreen = () => window.location.pathname.startsWith("/study/games/challenge/");

export const apiErrorMessage = (error, fallback = "Something went wrong.") =>
  error.response?.data?.error?.message || fallback;

// A small message shown by the global host (a toast), from anywhere.
export function showChallengeNotice(message, tone = "info") {
  realtime.dispatchEvent(new CustomEvent("gameChallenge:notice", { detail: { message, tone } }));
}
