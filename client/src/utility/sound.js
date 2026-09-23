// Centralized sound playback for the app's realtime UI feedback (new
// message, softer in-conversation message, reaction). Kept as plain
// `Audio` instances — no new dependency — with autoplay-restriction
// rejections swallowed since a blocked sound is never worth surfacing as
// an error to the user.
function playSound(src, volume) {
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    const playPromise = audio.play();
    playPromise?.catch(() => {});
  } catch {
    // Audio unsupported/blocked — non-fatal.
  }
}

export const playIncomingMessageSound = () => playSound("/sounds/message.mp3", 0.6);

// Used instead of the above when the message's own conversation is already
// open on screen — same "something arrived" cue, deliberately softer/
// calmer so it doesn't compete with the message already being visible.
export const playSoftMessageSound = () => playSound("/sounds/message-soft.wav", 0.35);

export const playReactionSound = () => playSound("/sounds/reaction.wav", 0.4);

// Quiz answer feedback (QuizPlayer.jsx) — fire-and-forget cues like the
// ones above.
export const playCorrectAnswerSound = () => playSound("/sounds/correctAnswer.mp3", 0.6);

export const playWrongAnswerSound = () => playSound("/sounds/wronanswer.mp3", 0.6);

// Quiz countdown beep (QuizPlayer.jsx) — plays at the 10s-left and 5s-left
// marks. A short synthesized blip via the Web Audio API rather than an
// audio file, since it just needs to be a quick, unmistakable "tick," not
// a longer clip to manage/cut off. The AudioContext is created lazily on
// first use and reused for every later beep (creating a fresh one per call
// is unnecessary and some browsers cap how many can exist at once).
let beepContext = null;

export function playCountdownBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!beepContext) {
      beepContext = new Ctx();
    }
    if (beepContext.state === "suspended") {
      beepContext.resume().catch(() => {});
    }

    const oscillator = beepContext.createOscillator();
    const gain = beepContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, beepContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, beepContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, beepContext.currentTime + 0.2);
    oscillator.connect(gain);
    gain.connect(beepContext.destination);
    oscillator.start();
    oscillator.stop(beepContext.currentTime + 0.22);
  } catch {
    // Sound is a nice-to-have — never let it break the quiz.
  }
}
