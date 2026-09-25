import { motion as Motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import Avatar from "../ui/Avatar";
import Button from "../ui/Button";
import { api } from "../../utility/api";
import { apiErrorMessage, challengeMatchPath, onChallengeScreen } from "../../utility/gameChallenge";
import { useRealtime } from "../../utility/helpers";
import { playReactionSound } from "../../utility/sound";
import useButtonColorFix from "../../utility/useButtonColorFix";

const NOTICE_MS = 3800;

function RequestCard({ request, busy, onAccept, onDecline, onExpired }) {
  const reduced = useReducedMotion();
  const primaryFix = useButtonColorFix("primary");
  const outlineFix = useButtonColorFix("outline");
  const [fraction, setFraction] = useState(1);
  // The window length when the card first appeared — the countdown bar's full width.
  const [total] = useState(() => Math.max(1000, new Date(request.expiresAt) - Date.now()));

  useEffect(() => {
    const id = setInterval(() => {
      const left = new Date(request.expiresAt) - Date.now();
      setFraction(Math.max(0, Math.min(1, left / total)));
      if (left <= 0) onExpired(request.id);
    }, 250);
    return () => clearInterval(id);
  }, [request.expiresAt, request.id, total, onExpired]);

  const rematch = request.kind === "rematch";
  const name = request.from?.fullName || "A friend";

  return (
    <Motion.div
      layout={!reduced}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -18, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      role="alertdialog"
      aria-label={`${name} ${rematch ? "wants to play again" : "challenged you to"} ${request.gameName}`}
      data-testid="challenge-request"
      className="ch-request pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_18px_50px_-12px_rgba(0,0,0,0.35)]"
    >
      <div className="flex items-center gap-3 p-3.5">
        <span className="ch-request-avatar">
          <Avatar person={request.from} size="md" />
          {!reduced && <span className="ch-request-ring" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{name}</p>
          <p className="text-xs leading-snug text-muted">{rematch ? "wants to play again" : "challenged you to"}</p>
          <p className="truncate text-sm font-semibold text-accent">“{request.gameName}”</p>
        </div>
        <span className="game-tile game-tile--sm shrink-0" aria-hidden="true">
          {request.gameIcon}
        </span>
      </div>

      <div className="flex gap-2 px-3.5 pb-3.5">
        <Button
          variant="primary"
          size="sm"
          className="min-h-11 min-w-0 flex-1"
          loading={busy === "accept"}
          disabled={Boolean(busy)}
          onClick={() => onAccept(request)}
          style={primaryFix.style}
          onMouseEnter={primaryFix.onMouseEnter}
          onMouseLeave={primaryFix.onMouseLeave}
        >
          Accept
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 min-w-0 flex-1"
          loading={busy === "decline"}
          disabled={Boolean(busy)}
          onClick={() => onDecline(request)}
          style={outlineFix.style}
          onMouseEnter={outlineFix.onMouseEnter}
          onMouseLeave={outlineFix.onMouseLeave}
        >
          Decline
        </Button>
      </div>

      <div className="h-1 bg-soft" aria-hidden="true">
        <div className="h-full bg-accent transition-[width] duration-300 ease-linear" style={{ width: `${fraction * 100}%` }} />
      </div>
    </Motion.div>
  );
}

const toneClass = {
  success: "border-green-500/50",
  error: "border-danger/50",
  info: "border-line",
};

/**
 * Application-level friend-challenge popup: a friend's challenge (or "play
 * again" request) with Accept / Decline, plus short status notices. Mounted
 * once, above both the main and the Study shells (see Router/Main.jsx), so it
 * appears on ANY page — Feed, Messages, Profile, Study, Games… Nothing here
 * decides anything: requests come from the server (over the one existing
 * socket, and re-fetched on reconnect), and Accept / Decline are server calls.
 */
export default function GameChallengeGlobalHost({ user }) {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [requests, setRequests] = useState([]);
  const [notices, setNotices] = useState([]);
  const [busy, setBusy] = useState({});
  const noticeId = useRef(0);

  const remove = useCallback((id) => setRequests((current) => current.filter((item) => item.id !== id)), []);

  const notify = useCallback((message, tone = "info") => {
    const id = ++noticeId.current;
    setNotices((current) => [...current.slice(-2), { id, message, tone }]);
    setTimeout(() => setNotices((current) => current.filter((item) => item.id !== id)), NOTICE_MS);
  }, []);

  // Anything already waiting (sent while this tab was closed, or while the
  // socket was reconnecting) — fetched on load and on every reconnect.
  const loadPending = useCallback(async () => {
    try {
      const { data } = await api.get("/games/challenges/invites/pending");
      setRequests(data.data.incoming);
    } catch {
      /* a missing popup is never worth an error */
    }
  }, []);

  useEffect(() => {
    // Initial hydration of pending requests; state is set after the response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPending();
  }, [loadPending]);

  useRealtime("realtime:connected", loadPending);

  const onIncoming = (event) => {
    const invite = event.detail?.invite;
    if (!invite || invite.to?.id !== user.id) return;
    setRequests((current) => [invite, ...current.filter((item) => item.id !== invite.id)]);
    playReactionSound();
  };
  useRealtime("gameChallenge:invite", onIncoming);
  useRealtime("gameChallenge:rematch", onIncoming);

  const onClosed = (event) => remove(event.detail?.requestId || event.detail?.inviteId);
  useRealtime("gameChallenge:cancelled", onClosed);
  useRealtime("gameChallenge:expired", onClosed);
  useRealtime("gameChallenge:rematchCancelled", onClosed);
  useRealtime("gameChallenge:rematchExpired", onClosed);

  // Someone (maybe another of my tabs) accepted: close the popup; if the OTHER
  // player accepted my request, take me straight into the match.
  const onAccepted = (event) => {
    const { requestId, matchId, by } = event.detail || {};
    remove(requestId);
    if (by && by !== user.id && matchId) {
      notify("Your friend accepted — challenge on!", "success");
      navigate(challengeMatchPath(matchId));
    }
  };
  useRealtime("gameChallenge:accepted", onAccepted);
  useRealtime("gameChallenge:rematchAccepted", onAccepted);

  const onDeclined = (event) => {
    const { requestId, by, kind } = event.detail || {};
    remove(requestId);
    if (by && by !== user.id) {
      // On the match screen the "Rematch declined." message is shown in place.
      if (kind === "rematch" && onChallengeScreen()) return;
      notify(kind === "rematch" ? "Rematch declined." : "Your challenge was declined.", "info");
    }
  };
  useRealtime("gameChallenge:declined", onDeclined);
  useRealtime("gameChallenge:rematchDeclined", onDeclined);

  // Messages raised by other parts of the app (e.g. "Challenge sent").
  useRealtime("gameChallenge:notice", (event) => notify(event.detail?.message, event.detail?.tone));

  const respond = async (request, action) => {
    setBusy((current) => ({ ...current, [request.id]: action }));
    const base = request.kind === "rematch" ? "rematch" : "invites";
    try {
      const { data } = await api.post(`/games/challenges/${base}/${request.id}/${action}`);
      remove(request.id);
      if (action === "accept") navigate(challengeMatchPath(data.data.match.id));
    } catch (error) {
      // Expired / withdrawn / no longer friends / busy: say so and clear the popup.
      remove(request.id);
      notify(apiErrorMessage(error, "That challenge is no longer available."), "error");
    } finally {
      setBusy((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
    }
  };

  if (!requests.length && !notices.length) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(var(--topbar-h,72px)+8px)] z-[81] flex flex-col items-center gap-2 px-3"
    >
      <AnimatePresence initial={false}>
        {requests.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            busy={busy[request.id]}
            onAccept={(item) => respond(item, "accept")}
            onDecline={(item) => respond(item, "decline")}
            onExpired={remove}
          />
        ))}
        {notices.map((notice) => (
          <Motion.div
            key={`n${notice.id}`}
            layout={!reduced}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="status"
            className={`pointer-events-auto max-w-sm rounded-xl border bg-panel px-3.5 py-2.5 text-xs font-semibold text-ink shadow-soft ${toneClass[notice.tone] || toneClass.info}`}
          >
            {notice.message}
          </Motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
