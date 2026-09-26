import { useSyncExternalStore } from "react";

// Ludo sound, music and vibration.
//
// No audio files: every effect is synthesized with the Web Audio API, so there is
// nothing to download and every sound can be switched off. Settings are saved per
// signed-in user in localStorage; the local (offline) mode reads the same ones.
// Sound is a nicety — every call is wrapped so a blocked/unsupported AudioContext
// or vibration API never breaks the game.

const DEFAULTS = Object.freeze({ sound: true, music: false, vibration: true, notifications: true });
const keyFor = (userId) => `kb-ludo-settings:${userId || "guest"}`;

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

/** Points the audio settings at a user (call once the signed-in user is known). */
export function configureLudoAudio(userId) {
  if (userId === currentUser) return;
  currentUser = userId;
  settings = load(userId);
  listeners.forEach((listener) => listener());
  if (!settings.music) stopMusic();
}

export const getLudoSettings = () => settings;

export function updateLudoSettings(patch) {
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(keyFor(currentUser), JSON.stringify(settings));
  } catch {
    /* private mode — the setting still applies for this session */
  }
  if (!settings.music) stopMusic();
  listeners.forEach((listener) => listener());
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const useLudoSettings = () => useSyncExternalStore(subscribe, getLudoSettings, getLudoSettings);

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

function noise({ start = 0, duration = 0.08, gain = 0.1, freq = 1800, q = 0.9 }) {
  const ctx = audio();
  if (!ctx) return;
  try {
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = q;
    const amp = ctx.createGain();
    amp.gain.value = gain;
    source.connect(filter);
    filter.connect(amp);
    amp.connect(ctx.destination);
    source.start(ctx.currentTime + start);
  } catch {
    /* ignore */
  }
}

const play = (fn) => {
  if (settings.sound) fn();
};

export const ludoSfx = {
  click: () => play(() => tone({ freq: 520, to: 700, duration: 0.06, gain: 0.08, type: "triangle" })),
  diceRoll: () =>
    play(() => {
      for (let i = 0; i < 7; i++) noise({ start: i * 0.085, duration: 0.06, gain: 0.09, freq: 1200 + (i % 3) * 700 });
      tone({ freq: 200, to: 120, duration: 0.55, gain: 0.04, type: "square" });
    }),
  diceLand: () =>
    play(() => {
      tone({ freq: 160, to: 70, duration: 0.14, gain: 0.2, type: "triangle" });
      noise({ duration: 0.05, gain: 0.12, freq: 900 });
    }),
  step: () => play(() => tone({ freq: 620 + Math.random() * 60, to: 480, duration: 0.05, gain: 0.07, type: "triangle" })),
  exit: () => play(() => [0, 1, 2].forEach((i) => tone({ freq: 440 * 1.26 ** i, start: i * 0.06, duration: 0.1, gain: 0.1, type: "triangle" }))),
  capture: () =>
    play(() => {
      tone({ freq: 520, to: 90, duration: 0.32, gain: 0.18, type: "sawtooth" });
      noise({ duration: 0.18, gain: 0.14, freq: 700, start: 0.02 });
    }),
  home: () => play(() => [523, 659, 784, 1047].forEach((freq, i) => tone({ freq, start: i * 0.08, duration: 0.18, gain: 0.12, type: "triangle" }))),
  turn: () => play(() => [660, 880].forEach((freq, i) => tone({ freq, start: i * 0.09, duration: 0.12, gain: 0.09 }))),
  countdown: (final = false) => play(() => tone({ freq: final ? 1046 : 660, duration: final ? 0.32 : 0.14, gain: 0.14, type: "triangle" })),
  timerWarn: () => play(() => tone({ freq: 880, duration: 0.09, gain: 0.12, type: "square" })),
  win: () => play(() => [523, 659, 784, 659, 784, 1047].forEach((freq, i) => tone({ freq, start: i * 0.11, duration: 0.24, gain: 0.13, type: "triangle" }))),
  lose: () => play(() => [392, 349, 311].forEach((freq, i) => tone({ freq, start: i * 0.16, duration: 0.3, gain: 0.1, type: "sine" }))),
  achievement: () => play(() => [784, 988, 1175, 1568].forEach((freq, i) => tone({ freq, start: i * 0.07, duration: 0.2, gain: 0.1 }))),
  reaction: () => play(() => tone({ freq: 700, to: 1000, duration: 0.09, gain: 0.09, type: "triangle" })),
  chat: () => play(() => tone({ freq: 900, duration: 0.05, gain: 0.06 })),
  matchFound: () => play(() => [523, 784, 1047].forEach((freq, i) => tone({ freq, start: i * 0.1, duration: 0.22, gain: 0.12, type: "triangle" }))),
  invite: () => {
    if (settings.notifications) ludoSfx.matchFound();
  },
};

// ---- Vibration -----------------------------------------------------------------------------
export function vibrate(pattern) {
  try {
    if (settings.vibration && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
  } catch {
    /* not supported */
  }
}
export const ludoHaptics = {
  dice: () => vibrate(25),
  step: () => vibrate(8),
  capture: () => vibrate([60, 40, 90]),
  warn: () => vibrate(45),
  win: () => vibrate([80, 60, 80, 60, 160]),
};

// ---- Music (a soft looping arpeggio; off by default) -----------------------------------------
let musicTimer = null;
const PENTATONIC = [261.63, 293.66, 329.63, 392, 440, 523.25];

export function startMusic() {
  if (!settings.music || musicTimer || !audio()) return;
  let step = 0;
  const tick = () => {
    if (!settings.music) return stopMusic();
    const freq = PENTATONIC[(step * 2 + (step % 3)) % PENTATONIC.length];
    tone({ freq, duration: 0.9, gain: 0.025, attack: 0.05, type: "sine" });
    if (step % 4 === 0) tone({ freq: freq / 2, duration: 1.6, gain: 0.02, attack: 0.1, type: "triangle" });
    step += 1;
  };
  tick();
  musicTimer = setInterval(tick, 700);
}

export function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}
