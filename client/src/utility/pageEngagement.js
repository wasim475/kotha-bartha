import { api } from "./api";

// Page analytics: which page is open and for how long it was ACTIVELY used.
//
// One "view" per page visit. It is announced once, then reported as a running total of
// active seconds — every ~20s while there is something new, when the tab is hidden, and
// once more (final) when the visit ends. All reports carry the same viewId, so the
// server keeps a single record however long the visit lasts.
//
// Active time counts only while the tab is visible and the person has done something
// (pointer, key, scroll, touch) within the last IDLE_MS. The server validates and caps
// every report; this module only measures. Nothing but the page path, a random session
// id and a random view id ever leaves the browser.

const HEARTBEAT_MS = 20 * 1000;
const IDLE_MS = 5 * 60 * 1000;
const THROTTLE_MS = 1000;
const ROLLOVER_MS = 11 * 60 * 60 * 1000; // the server refuses visits older than 12h

const INTERACTIONS = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart", "wheel"];

const randomId = () => {
  try {
    return crypto.randomUUID().replaceAll("-", "");
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
  }
};

let memorySession = ""; // used only if sessionStorage is unavailable

// One random id per browser tab session. Holds no personal data; a signed-in visitor is
// attributed by the SERVER from the session cookie.
export function getSessionId() {
  try {
    let id = sessionStorage.getItem("kb-session");
    if (!id) {
      id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
      sessionStorage.setItem("kb-session", id);
    }
    return id;
  } catch {
    return (memorySession ||= `anon${Math.random().toString(36).slice(2, 14)}`);
  }
}
const deviceType = () => {
  const width = window.innerWidth;
  return width < 768 ? "mobile" : width < 1024 ? "tablet" : "desktop";
};

const isVisible = () => document.visibilityState !== "hidden";

let view = null; // the visit being measured
let listening = false;
let timer = null;
let lastInteractionEvent = 0;

// ---- Measuring --------------------------------------------------------------------

// Closes the running stretch of active time (if any) at the moment it really ended.
function commit(now) {
  if (view.segStart == null) return;
  const end = Math.min(now, view.lastInteraction + IDLE_MS);
  if (end > view.segStart) {
    view.active += end - view.segStart;
    view.lastActiveEnd = end;
  }
  view.segStart = null;
}

function activeMs(now) {
  if (view.segStart == null) return view.active;
  return view.active + Math.max(0, Math.min(now, view.lastInteraction + IDLE_MS) - view.segStart);
}

const lastActivity = (now) => (view.segStart == null ? view.lastActiveEnd : Math.max(view.lastActiveEnd, Math.min(now, view.lastInteraction + IDLE_MS)));

// ---- Reporting --------------------------------------------------------------------

async function post(payload) {
  const url = `${api.defaults.baseURL}/analytics/page-engagement`;
  try {
    // keepalive lets the request finish even while the page is being closed.
    const response = await fetch(url, { method: "POST", credentials: "include", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429); // a refusal will not get better by resending
  } catch {
    return false;
  }
}

function report({ final = false } = {}) {
  if (!view) return;
  const now = Date.now();
  const target = view;
  const durationSeconds = Math.floor(activeMs(now) / 1000);
  if (!final && durationSeconds <= target.lastSent) return; // nothing new to say

  const previous = target.lastSent;
  target.lastSent = durationSeconds;
  post({
    sessionId: getSessionId(),
    viewId: target.id,
    path: target.path,
    enteredAt: target.enteredAt,
    lastActivityAt: lastActivity(now),
    sentAt: now,
    durationSeconds,
    final,
    device: deviceType(),
  }).then((ok) => {
    // Offline or server trouble: forget it was sent so the next heartbeat repeats it.
    if (!ok && !final && target.lastSent === durationSeconds) target.lastSent = previous;
  });
}

function finalize() {
  if (!view) return;
  commit(Date.now());
  report({ final: true });
  view = null;
}

function start(path) {
  const now = Date.now();
  view = { id: randomId(), path, enteredAt: now, active: 0, segStart: isVisible() ? now : null, lastInteraction: now, lastActiveEnd: now, lastSent: -1 };
  api.post("/analytics/pageview", { sessionId: getSessionId(), viewId: view.id, path, device: deviceType() }).catch(() => {});
}

// ---- Browser lifecycle ---------------------------------------------------------------

function onInteraction() {
  const now = Date.now();
  if (!view || now - lastInteractionEvent < THROTTLE_MS || !isVisible()) return;
  lastInteractionEvent = now;
  if (view.segStart == null) {
    view.segStart = now;
  } else if (now - view.lastInteraction > IDLE_MS) {
    commit(now); // the idle stretch is not counted; a new one starts now
    view.segStart = now;
  }
  view.lastInteraction = now;
}

function onVisibility() {
  if (!view) return;
  const now = Date.now();
  if (!isVisible()) {
    commit(now); // pause: nothing counts while another tab or app is in front
    report(); // the last chance on mobile, where "pagehide" may never come
    return;
  }
  if (now - view.enteredAt > ROLLOVER_MS) {
    const path = view.path;
    finalize();
    start(path);
    return;
  }
  if (view.segStart == null) view.segStart = now; // resume
  view.lastInteraction = now;
}

function onPageHide() {
  finalize();
}

function onPageShow(event) {
  // Back/forward cache restored a page whose visit was already closed.
  if (event.persisted && !view) start(window.location.pathname);
}

const onOnline = () => report();

export function startTracking() {
  if (listening) return;
  listening = true;
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("online", onOnline);
  INTERACTIONS.forEach((name) => window.addEventListener(name, onInteraction, { passive: true, capture: true }));
  timer = setInterval(() => {
    if (view && isVisible()) report();
  }, HEARTBEAT_MS);
}

export function stopTracking() {
  if (!listening) return;
  listening = false;
  document.removeEventListener("visibilitychange", onVisibility);
  window.removeEventListener("pagehide", onPageHide);
  window.removeEventListener("pageshow", onPageShow);
  window.removeEventListener("online", onOnline);
  INTERACTIONS.forEach((name) => window.removeEventListener(name, onInteraction, { capture: true }));
  clearInterval(timer);
}

/**
 * A route was entered. The previous visit is closed first. Calling it again for the
 * page that is already open (React Strict Mode, a re-render) does nothing, so one
 * visit can never turn into two.
 */
export function trackPage(path) {
  if (view && view.path === path) return;
  finalize();
  start(path);
}
