import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { Close, SportsEsports } from "@mui/icons-material";
import { AnimatePresence, motion as Motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

import Avatar from "../../../../components/ui/Avatar";
import { api } from "../../../../utility/api";
import { apiErrorMessage } from "../../../../utility/gameChallenge";
import { useRealtime } from "../../../../utility/helpers";
import FixedButton from "../components/FixedButton";
import useOnlineFriends from "./useOnlineFriends";

function FriendRow({ friend, disabled, busy, onChallenge }) {
  const reduced = useReducedMotion();
  return (
    <Motion.li
      layout={!reduced}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, x: -12 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 rounded-xl border border-line bg-panel p-2.5"
    >
      <Avatar person={friend} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{friend.fullName}</p>
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
          <span className="size-2 shrink-0 rounded-full bg-green-500" aria-hidden="true" /> Online
        </p>
      </div>
      <FixedButton variant="primary" size="sm" className="min-h-11 shrink-0" loading={busy} disabled={disabled} onClick={() => onChallenge(friend)}>
        Challenge
      </FixedButton>
    </Motion.li>
  );
}

/**
 * "Play with Friend": pick an ONLINE friend to challenge to `game`. The list is
 * the server's (online, unblocked friends only) and updates live as friends
 * come online or go offline. After sending, the dialog shows "waiting for X"
 * until they accept (the global host then opens the match for both), decline,
 * or the 60-second invitation lapses.
 */
export default function ChallengeFriendPicker({ game, onClose }) {
  const friends = useOnlineFriends();
  const [sendingId, setSendingId] = useState(null);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(null); // { invite, to }
  const [now, setNow] = useState(0);
  const open = Boolean(game);

  // A countdown for the invitation we are waiting on.
  useEffect(() => {
    if (!sent) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [sent]);

  const closeIfMine = (event) => {
    if (sent && (event.detail?.requestId === sent.invite.id || event.detail?.inviteId === sent.invite.id)) onClose();
  };
  useRealtime("gameChallenge:accepted", closeIfMine);
  useRealtime("gameChallenge:declined", closeIfMine);
  useRealtime("gameChallenge:cancelled", closeIfMine);
  useRealtime("gameChallenge:expired", closeIfMine);

  if (!game) return null;

  const challenge = async (friend) => {
    setSendingId(friend.id);
    setError("");
    try {
      const { data } = await api.post("/games/challenges/invites", { userId: friend.id, gameType: game.type });
      setSent({ invite: data.data, to: friend });
      setNow(Date.now());
    } catch (requestError) {
      const body = requestError.response?.data?.error;
      setError(apiErrorMessage(requestError, "Couldn't send the challenge."));
      if (body?.code === "TARGET_OFFLINE") friends.reload(); // show the truth
    } finally {
      setSendingId(null);
    }
  };

  const cancel = async () => {
    try {
      await api.post(`/games/challenges/invites/${sent.invite.id}/cancel`);
    } catch {
      /* already answered — the events below close things out */
    }
    onClose();
  };

  const list = friends.data || [];
  const secondsLeft = sent ? Math.max(0, Math.ceil((new Date(sent.invite.expiresAt).getTime() - now) / 1000)) : 0;

  return (
    <Dialog open={open} onClose={sent ? () => {} : onClose} className="relative z-50">
      <DialogBackdrop transition className="fixed inset-0 bg-black/40 transition-opacity duration-150 data-[closed]:opacity-0" />
      <div className="fixed inset-0 flex items-end justify-center p-3 sm:items-center sm:p-4">
        <DialogPanel
          transition
          className="games-scope flex max-h-[85dvh] w-full max-w-sm flex-col gap-3 overflow-hidden rounded-2xl border border-line bg-panel p-4 shadow-soft transition duration-150 data-[closed]:translate-y-3 data-[closed]:opacity-0"
          data-tone={game.category === "english" ? "english" : "math"}
        >
          <div className="flex items-start gap-3">
            <span className="game-tile game-tile--sm" aria-hidden="true">
              {game.icon}
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-display text-lg leading-tight font-semibold text-ink">Play with Friend</DialogTitle>
              <p className="truncate text-xs text-muted">{game.name} · 10 questions, same for both</p>
            </div>
            {!sent && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
              >
                <Close fontSize="small" />
              </button>
            )}
          </div>

          {sent ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center" data-testid="challenge-waiting">
              <Motion.span
                className="text-3xl"
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                aria-hidden="true"
              >
                <SportsEsports fontSize="inherit" />
              </Motion.span>
              <Avatar person={sent.to} size="lg" />
              <p className="text-sm font-semibold text-ink">Waiting for {sent.to.fullName} to accept…</p>
              <p className="text-xs text-muted">The challenge expires in {secondsLeft}s.</p>
              <FixedButton variant="outline" size="sm" className="min-h-11" onClick={cancel}>
                Cancel challenge
              </FixedButton>
            </div>
          ) : (
            <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
              {friends.loading ? (
                <p className="py-6 text-center text-sm text-muted">Looking for friends who are online…</p>
              ) : list.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-muted">No friends are online right now.</p>
              ) : (
                <ul className="flex flex-col gap-2" aria-label="Online friends">
                  <AnimatePresence initial={false}>
                    {list.map((friend) => (
                      <FriendRow key={friend.id} friend={friend} busy={sendingId === friend.id} disabled={sendingId !== null} onChallenge={challenge} />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
              {friends.error && !list.length && <p className="text-center text-xs text-danger">{friends.error}</p>}
              {error && (
                <p role="alert" className="text-center text-xs font-medium text-danger">
                  {error}
                </p>
              )}
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
