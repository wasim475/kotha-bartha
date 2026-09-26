import { motion as Motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import Avatar from "../ui/Avatar";
import Button from "../ui/Button";
import { api } from "../../utility/api";
import { useRealtime } from "../../utility/helpers";
import { apiErrorMessage, loadLudoCatalog, ludoLobbyPath, ludoPlayPath } from "../../utility/ludo";
import { configureLudoAudio, ludoSfx } from "../../utility/ludoSound";
import useButtonColorFix from "../../utility/useButtonColorFix";

const NOTICE_MS = 3800;

function RequestCard({ request, busy, onAccept, onDecline, onExpired }) {
  const reduced = useReducedMotion();
  const primaryFix = useButtonColorFix("primary");
  const outlineFix = useButtonColorFix("outline");
  const [fraction, setFraction] = useState(1);
  const [total] = useState(() => Math.max(1000, new Date(request.expiresAt) - Date.now()));
  const [variant, setVariant] = useState(null);

  useEffect(() => {
    let active = true;
    loadLudoCatalog()
      .then((catalog) => active && setVariant(catalog.variants.find((item) => item.id === request.variantId) || null))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [request.variantId]);

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
  const title = variant?.title || "Ludo";
  const players = variant ? (variant.minPlayers === variant.maxPlayers ? `${variant.maxPlayers} players` : `${variant.minPlayers}–${variant.maxPlayers} players`) : "";

  return (
    <Motion.div
      layout={!reduced}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      role="alertdialog"
      aria-label={rematch ? `${name} wants to play another ${title} match` : `${name} invited you to play ${title}`}
      data-testid="ludo-request"
      className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_18px_50px_-12px_rgba(0,0,0,0.35)]"
    >
      <div className="flex items-center gap-3 p-3.5">
        <Avatar person={request.from} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-wide text-muted uppercase">{rematch ? "Rematch" : "Ludo Challenge"}</p>
          <p className="truncate text-sm font-bold text-ink">{name}</p>
          <p className="text-xs leading-snug text-muted" data-testid="ludo-request-message">
            {rematch ? `Play another ${title} match?` : `${name.split(" ")[0]} invited you to play ${title}.`}
          </p>
          {players && <p className="mt-0.5 text-[11px] font-semibold text-muted">{players}</p>}
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-soft text-lg" aria-hidden="true">
          🎲
        </span>
      </div>

      <div className="flex gap-2 px-3.5 pb-3.5">
        <Button variant="primary" size="sm" className="min-h-11 min-w-0 flex-1" loading={busy === "accept"} disabled={Boolean(busy)} onClick={() => onAccept(request)} style={primaryFix.style} onMouseEnter={primaryFix.onMouseEnter} onMouseLeave={primaryFix.onMouseLeave} data-testid="ludo-accept">
          Accept
        </Button>
        <Button variant="outline" size="sm" className="min-h-11 min-w-0 flex-1" loading={busy === "decline"} disabled={Boolean(busy)} onClick={() => onDecline(request)} style={outlineFix.style} onMouseEnter={outlineFix.onMouseEnter} onMouseLeave={outlineFix.onMouseLeave} data-testid="ludo-decline">
          Decline
        </Button>
      </div>

      <div className="h-1 bg-soft" aria-hidden="true">
        <div className="h-full bg-accent transition-[width] duration-300 ease-linear" style={{ width: `${fraction * 100}%` }} />
      </div>
    </Motion.div>
  );
}

const toneClass = { success: "border-green-500/50", error: "border-danger/50", info: "border-line" };

/**
 * Application-level Ludo popup: invitations and rematch requests with Accept /
 * Decline, plus short status notices. Mounted once, above both the main and the
 * Study shells (see Router/Main.jsx), so it appears on ANY page. Nothing here
 * decides anything: requests come from the server (over the socket, and are
 * re-fetched on reconnect) and Accept/Decline are server calls.
 */
export default function LudoGlobalHost({ user }) {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [requests, setRequests] = useState([]);
  const [notices, setNotices] = useState([]);
  const [busy, setBusy] = useState({});
  const noticeId = useRef(0);

  useEffect(() => {
    configureLudoAudio(user.id);
  }, [user.id]);

  const remove = useCallback((id) => setRequests((current) => current.filter((item) => item.id !== id)), []);
  const notify = useCallback((message, tone = "info") => {
    const id = ++noticeId.current;
    setNotices((current) => [...current.slice(-2), { id, message, tone }]);
    setTimeout(() => setNotices((current) => current.filter((item) => item.id !== id)), NOTICE_MS);
  }, []);

  const loadPending = useCallback(async () => {
    try {
      const { data } = await api.get("/games/ludo/invites/pending");
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
    ludoSfx.invite();
  };
  useRealtime("ludo:invite", onIncoming);
  useRealtime("ludo:rematch", onIncoming);

  const onClosed = (event) => remove(event.detail?.requestId || event.detail?.inviteId);
  useRealtime("ludo:invite:cancelled", onClosed);
  useRealtime("ludo:invite:expired", onClosed);
  useRealtime("ludo:rematch:cancelled", onClosed);
  useRealtime("ludo:rematch:expired", onClosed);
  // My own other tab answered it — close the popup here too.
  useRealtime("ludo:invite:accepted", (event) => remove(event.detail?.requestId));
  useRealtime("ludo:rematch:accepted", (event) => remove(event.detail?.requestId));

  const onDeclined = (event) => {
    const { requestId, by, kind } = event.detail || {};
    remove(requestId);
    if (by && by !== user.id) notify(kind === "rematch" ? "Rematch declined." : "Your Ludo invitation was declined.", "info");
  };
  useRealtime("ludo:invite:declined", onDeclined);
  useRealtime("ludo:rematch:declined", onDeclined);
  useRealtime("ludo:notice", (event) => notify(event.detail?.message, event.detail?.tone));

  const respond = async (request, action) => {
    setBusy((current) => ({ ...current, [request.id]: action }));
    try {
      const { data } = await api.post(`/games/ludo/invites/${request.id}/${action}`);
      remove(request.id);
      if (action === "accept") {
        const game = data.data.game;
        navigate(game.status === "active" ? ludoPlayPath(game.id) : ludoLobbyPath(game.id));
      }
    } catch (error) {
      remove(request.id);
      const body = error.response?.data?.error;
      if (body?.code === "ALREADY_IN_GAME" && body.gameId) {
        notify("Finish or leave your current Ludo game first.", "error");
        return;
      }
      notify(apiErrorMessage(error, "That invitation is no longer available."), "error");
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
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(var(--topbar-h,72px)+8px)] z-[80] flex flex-col items-center gap-2 px-3 sm:items-end sm:pr-4">
      <AnimatePresence initial={false}>
        {requests.map((request) => (
          <RequestCard key={request.id} request={request} busy={busy[request.id]} onAccept={(item) => respond(item, "accept")} onDecline={(item) => respond(item, "decline")} onExpired={remove} />
        ))}
        {notices.map((notice) => (
          <Motion.div key={`n${notice.id}`} layout={!reduced} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status" className={`pointer-events-auto max-w-sm rounded-xl border bg-panel px-3.5 py-2.5 text-xs font-semibold text-ink shadow-soft ${toneClass[notice.tone] || toneClass.info}`}>
            {notice.message}
          </Motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
