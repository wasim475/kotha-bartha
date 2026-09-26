import { SendRounded } from "@mui/icons-material";
import { AnimatePresence, motion as Motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import Card from "../../../../../components/ui/Card";
import { LUDO_REACTIONS } from "../../../../../utility/ludo";
import { ludoSfx } from "../../../../../utility/ludoSound";

const MAX = 140;

// Each reaction has its own short motion. transform / opacity only.
const MOTION = {
  haha: { animate: { y: [0, -34, 0, -20, 0], scale: [0.4, 1.25, 1, 1.15, 1], opacity: [0, 1, 1, 1, 0] }, transition: { duration: 1.9 } },
  goodmove: { animate: { scale: [0.3, 1.3, 1], rotate: [-10, 8, 0], opacity: [0, 1, 1, 0] }, transition: { duration: 1.9, times: [0, 0.2, 0.5, 1] } },
  nice: { animate: { scale: [0, 1.4, 0.95, 1.05, 1], opacity: [0, 1, 1, 1, 0] }, transition: { duration: 1.7 } },
  great: { animate: { y: [10, -10, -26, -44], scale: [0.6, 1.25, 1.1, 0.9], opacity: [0, 1, 1, 0] }, transition: { duration: 1.9 } },
  oops: { animate: { x: [0, -12, 12, -9, 9, -4, 0], opacity: [0, 1, 1, 1, 1, 1, 0], scale: [0.7, 1, 1, 1, 1, 1, 1] }, transition: { duration: 1.6 } },
  hi: { animate: { rotate: [0, 24, -12, 24, -12, 0], scale: [0.5, 1.1, 1.1, 1.1, 1.1, 1], opacity: [0, 1, 1, 1, 1, 0] }, transition: { duration: 1.8 }, style: { transformOrigin: "70% 90%" } },
};

const glyph = (type) => LUDO_REACTIONS.find((reaction) => reaction.type === type);

/** The animated reactions floating over the board (sender's name underneath). */
export function EmoteLayer({ emotes, nameOf }) {
  const reduced = useReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[14px]" aria-hidden="true" data-testid="ludo-emotes">
      <AnimatePresence>
        {emotes.map((emote, index) => {
          const config = MOTION[emote.type] || MOTION.nice;
          const info = glyph(emote.type);
          return (
            <Motion.div
              key={emote.id}
              className="ludo-emote"
              style={{ left: `${22 + ((index * 23) % 56)}%`, top: "58%", ...(reduced ? {} : config.style) }}
              initial={reduced ? { opacity: 0 } : { opacity: 0 }}
              animate={reduced ? { opacity: [0, 1, 1, 0] } : config.animate}
              exit={{ opacity: 0 }}
              transition={reduced ? { duration: 1.4 } : config.transition}
              data-testid={`ludo-emote-${emote.type}`}
            >
              <span className="block text-center">{info?.emoji}</span>
              <span className="block max-w-28 truncate rounded-full bg-black/60 px-2 py-0.5 text-center text-[10px] font-bold text-white">{nameOf(emote.from)}</span>
            </Motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/** Short text chat + quick reactions. The server validates and rate-limits both. */
export default function ChatPanel({ chat, onSend, onReact, disabled }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [cooling, setCooling] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [chat.length]);

  const submit = async (event) => {
    event.preventDefault();
    const message = text.trim();
    if (!message || disabled) return;
    setError("");
    const result = await onSend(message);
    if (result?.ok) setText("");
    else setError(result?.error?.message || "Couldn't send.");
  };

  const react = async (type) => {
    if (cooling || disabled) return;
    setCooling(true);
    ludoSfx.reaction();
    await onReact(type);
    setTimeout(() => setCooling(false), 500);
  };

  return (
    <Card className="flex flex-col gap-2.5 p-3" data-testid="ludo-chat">
      <div className="ludo-react-row" role="group" aria-label="Quick reactions">
        {LUDO_REACTIONS.map((reaction) => (
          <button key={reaction.type} type="button" className="ludo-react-btn" disabled={disabled || cooling} onClick={() => react(reaction.type)} aria-label={reaction.label} title={reaction.label} data-testid={`ludo-react-${reaction.type}`}>
            <span aria-hidden="true">{reaction.emoji}</span>
          </button>
        ))}
      </div>

      <div ref={logRef} className="ludo-chat-log" role="log" aria-live="polite" aria-label="Game chat" data-testid="ludo-chat-log">
        {chat.length === 0 && <p className="text-xs text-muted">Say hi to the table 👋</p>}
        {chat.map((message) => (
          <p key={message.id} className="text-xs leading-snug wrap-anywhere text-ink">
            <strong className="font-bold">{message.from?.fullName?.split(" ")[0] || "Player"}: </strong>
            {message.text}
          </p>
        ))}
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, MAX))}
          maxLength={MAX}
          placeholder="Type a short message"
          aria-label="Chat message"
          disabled={disabled}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          data-testid="ludo-chat-input"
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          aria-label="Send message"
          className="grid min-h-11 min-w-11 place-items-center rounded-xl text-white disabled:opacity-50"
          style={{ background: "var(--accent)" }}
          data-testid="ludo-chat-send"
        >
          <SendRounded fontSize="small" />
        </button>
      </form>
      {error && (
        <p role="status" className="text-[11px] font-medium text-muted">
          {error}
        </p>
      )}
    </Card>
  );
}
