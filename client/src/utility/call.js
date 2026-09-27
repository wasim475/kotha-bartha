import { api } from "./api";

// Client helpers for 1-to-1 calling. Every rule — who may call whom, the
// call/session id, its state, accept/decline/end, screen-share ownership,
// reaction validity — lives on the server (server/src/services/call.service.js);
// these are thin wrappers that call it and surface its answer. WebRTC media
// itself never touches this file or the socket — only signalling does.

export const CALL_EVENTS = [
  "call:invite",
  "call:accepted",
  "call:declined",
  "call:cancelled",
  "call:missed",
  "call:signal",
  "call:state",
  "call:ended",
  "call:screen-share:start",
  "call:screen-share:stop",
  "call:reaction",
];

export const CALL_REACTIONS = [
  { type: "heart", emoji: "❤️", label: "Love" },
  { type: "thumbsup", emoji: "👍", label: "Thumbs up" },
  { type: "laugh", emoji: "😂", label: "Laugh" },
  { type: "wow", emoji: "😮", label: "Wow" },
  { type: "sad", emoji: "😢", label: "Sad" },
  { type: "fire", emoji: "🔥", label: "Fire" },
];

export const apiErrorMessage = (error, fallback = "Something went wrong.") =>
  error?.response?.data?.error?.message || error?.message || fallback;

export const startCall = (userId, video = true) => api.post("/calls", { userId, video }).then(({ data }) => data.data);
export const getActiveCall = () => api.get("/calls/active").then(({ data }) => data.data);
export const acceptCall = (callId) => api.post(`/calls/${callId}/accept`).then(({ data }) => data.data);
export const declineCall = (callId) => api.post(`/calls/${callId}/decline`).then(({ data }) => data.data);
export const cancelCall = (callId) => api.post(`/calls/${callId}/cancel`).then(({ data }) => data.data);
export const endCall = (callId) => api.post(`/calls/${callId}/end`).then(({ data }) => data.data);
export const getCallHistory = (page = 1) => api.get("/calls/history", { params: { page } }).then(({ data }) => data.data);

// ICE server configuration is environment-driven so a TURN server can be
// added for production reliability without a client rebuild (see
// VITE_STUN_URLS / VITE_TURN_URL / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL).
export function iceServers() {
  const servers = [{ urls: (import.meta.env.VITE_STUN_URLS || "stun:stun.l.google.com:19302").split(",") }];
  if (import.meta.env.VITE_TURN_URL) {
    servers.push({
      urls: import.meta.env.VITE_TURN_URL,
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL,
    });
  }
  return servers;
}
