import { useSyncExternalStore } from "react";

// Call ringtone, sounds and vibration. No audio files: every effect is
// synthesized with the Web Audio API (same approach as utility/ludoSound.js),
// so there's nothing to download and every sound can be switched off.
// Settings are saved per signed-in user in localStorage.

const DEFAULTS = Object.freeze({ ringtone: true, sounds: true, vibration: true });
const keyFor = (userId) => `kb-call-settings:${userId || "guest"}`;

let currentUser = null;
let settings = { ...DEFAULTS };
const listeners = new Set();

function load(userId) {
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(userId)) || "null");
    return { ...DEFAULTS, ...(raw && typeof raw === "object" ? Object.fromEntries(Object.entries(raw).filter(([key, value]) => key in DEFAULTS && typeof value === "boolean")) : {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function configureCallAudio(userId) {
  if (userId === currentUser) return;
  currentUser = userId;
  settings = load(userId);
  listeners.forEach((listener) => listener());
}

export const getCallSettings = () => settings;

export function updateCallSettings(patch) {
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(keyFor(currentUser), JSON.stringify(settings));
  } catch {
    /* private mode — the setting still applies for this session */
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const useCallSettings = () => useSyncExternalStore(subscribe, getCallSettings, getCallSettings);

// ---- Web Audio -------------------------------------------------------------------------
let context = null;
function audio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    context ||= new Ctx();
    if (context.state === "suspended") context.resume().catch(() => {});
    return context;
  } catch {
    return null;
  }
}

function tone({ freq, to = null, type = "sine", start = 0, duration = 0.15, gain = 0.15, attack = 0.008 }) {
  const ctx = audio();
  if (!ctx) return;
  try {
    const t0 = ctx.currentTime + start;
    const oscillator = ctx.createOscillator();
    const amp = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, t0);
    if (to) oscillator.frequency.exponentialRampToValueAtTime(to, t0 + duration);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    oscillator.connect(amp);
    amp.connect(ctx.destination);
    oscillator.start(t0);
    oscillator.stop(t0 + duration + 0.03);
  } catch {
    /* ignore */
  }
}

const play = (fn) => {
  if (settings.sounds) fn();
};

export const callSfx = {
  accepted: () => play(() => [523, 659, 784].forEach((freq, i) => tone({ freq, start: i * 0.08, duration: 0.16, gain: 0.12, type: "triangle" }))),
  declined: () => play(() => [392, 330].forEach((freq, i) => tone({ freq, start: i * 0.12, duration: 0.22, gain: 0.1, type: "sine" }))),
  connected: () => play(() => [660, 880, 1108].forEach((freq, i) => tone({ freq, start: i * 0.07, duration: 0.14, gain: 0.1, type: "triangle" }))),
  ended: () => play(() => [440, 330].forEach((freq, i) => tone({ freq, start: i * 0.1, duration: 0.2, gain: 0.09, type: "sine" }))),
  mute: (muted) => play(() => tone({ freq: muted ? 420 : 620, duration: 0.07, gain: 0.08, type: "square" })),
  camera: (on) => play(() => tone({ freq: on ? 700 : 380, duration: 0.06, gain: 0.07, type: "triangle" })),
  screenShare: (on) => play(() => tone({ freq: on ? 500 : 320, to: on ? 900 : 200, duration: 0.16, gain: 0.09, type: "sawtooth" })),
  message: () => play(() => tone({ freq: 900, duration: 0.05, gain: 0.06 })),
  reaction: () => play(() => tone({ freq: 700, to: 1000, duration: 0.09, gain: 0.09, type: "triangle" })),
};

// A looping ringtone — two soft ascending chimes, repeated. Started on an
// incoming or outgoing call and stopped the moment it's answered/ended, so
// it's always cleaned up alongside the call it belongs to.
let ringTimer = null;
export function startRingtone() {
  if (ringTimer) return;
  const chime = () => {
    if (settings.ringtone) [659, 880].forEach((freq, i) => tone({ freq, start: i * 0.14, duration: 0.3, gain: 0.13, type: "triangle" }));
    vibrate([300, 200, 300, 200]);
  };
  chime();
  ringTimer = setInterval(chime, 1700);
}
export function stopRingtone() {
  clearInterval(ringTimer);
  ringTimer = null;
}

// ---- Vibration -----------------------------------------------------------------------------
export function vibrate(pattern) {
  try {
    if (settings.vibration && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
  } catch {
    /* not supported */
  }
}
export const callHaptics = {
  ring: () => vibrate([300, 200, 300, 200]),
  accepted: () => vibrate(40),
  ended: () => vibrate(60),
};
