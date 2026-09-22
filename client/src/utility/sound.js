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
