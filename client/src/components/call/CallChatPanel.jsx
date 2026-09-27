import { Close, Send } from "@mui/icons-material";
import { motion as Motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { useCall } from "../../provider/CallProvider";

const formatTime = (date) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

/**
 * In-call text chat. Deliberately not a history viewer: it only shows what's
 * sent while this panel exists, over the SAME 1-to-1 conversation the call
 * belongs to — so the messages are ordinary messages, and stay in the normal
 * Messages thread after the call ends (nothing special to clean up).
 */
export default function CallChatPanel({ userId }) {
  const call = useCall();
  const reduced = useReducedMotion();
  const [text, setText] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [call?.chatMessages?.length]);

  if (!call || !call.chatOpen) return null;

  const submit = (event) => {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    call.sendChatMessage(body);
  };

  return (
    <Motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
      className="relative z-20 flex h-[38dvh] max-h-80 shrink-0 flex-col overflow-hidden rounded-t-2xl border-t sm:absolute sm:inset-x-auto sm:right-4 sm:bottom-24 sm:h-105 sm:max-h-105 sm:w-80 sm:rounded-2xl sm:border"
      style={{ background: "var(--call-panel-strong)", borderColor: "var(--call-line)" }}
      data-testid="call-chat-panel"
    >
      <div className="flex shrink-0 items-center justify-between border-b px-3.5 py-2.5" style={{ borderColor: "var(--call-line)" }}>
        <p className="text-sm font-bold" style={{ color: "var(--call-ink)" }}>In-call chat</p>
        <button type="button" aria-label="Close chat" onClick={call.toggleChat} className="grid size-8 place-items-center rounded-full" style={{ color: "var(--call-muted)" }}>
          <Close fontSize="small" />
        </button>
      </div>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3.5 py-3">
        {!call.chatMessages.length && <p className="text-center text-xs" style={{ color: "var(--call-muted)" }}>Say hello — messages here also land in your normal chat.</p>}
        {call.chatMessages.map((message) => {
          const isOwn = String(message.senderId) === String(userId);
          return (
            <div key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[80%] rounded-2xl px-3 py-1.5 text-sm"
                style={{ background: isOwn ? "var(--accent)" : "var(--call-line)", color: "#fff", opacity: message.pending ? 0.6 : 1 }}
              >
                <p className="break-words">{message.body}</p>
                <p className="mt-0.5 text-right text-[10px] opacity-70">{formatTime(message.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t p-2.5" style={{ borderColor: "var(--call-line)" }}>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Message…"
          className="min-w-0 flex-1 rounded-full border px-3.5 py-2 text-sm outline-none"
          style={{ background: "var(--call-panel)", borderColor: "var(--call-line)", color: "var(--call-ink)" }}
        />
        <button type="submit" aria-label="Send" disabled={!text.trim()} className="grid size-9 shrink-0 place-items-center rounded-full disabled:opacity-40" style={{ background: "var(--accent)", color: "#fff" }}>
          <Send fontSize="small" />
        </button>
      </form>
    </Motion.div>
  );
}
