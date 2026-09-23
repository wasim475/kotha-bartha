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

// Quiz timer/answer feedback (QuizPlayer.jsx). Correct/wrong are simple
// fire-and-forget cues like the ones above. The 10-second warning clip is
// ~11s long — longer than the time it's meant to cover — so the caller
// keeps the returned Audio instance and stops it early (pause + rewind)
// the moment the question is answered or a new one starts, rather than
// letting it play to completion underneath the next question.
export const playCorrectAnswerSound = () => playSound("/sounds/correctAnswer.mp3", 0.6);

export const playWrongAnswerSound = () => playSound("/sounds/wronanswer.mp3", 0.6);

export function playTenSecondWarningSound() {
  try {
    const audio = new Audio("/sounds/10secLeft.mp3");
    audio.volume = 0.5;
    audio.play()?.catch(() => {});
    return audio;
  } catch {
    return null;
  }
}

export function stopSound(audio) {
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch {
    // Nothing to clean up if the element is already gone/unsupported.
  }
}
