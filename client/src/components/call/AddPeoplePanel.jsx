import { Close, PersonAddAlt1 } from "@mui/icons-material";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { useEffect, useState } from "react";

import Avatar from "../../components/ui/Avatar";
import { useCall } from "../../provider/CallProvider";
import { getOnlineFriendsForCall } from "../../utility/call";

/**
 * "Add People" foundation (see server/src/models/Call.js's own comment): this
 * sends a real, server-authorized invitation, but the call itself stays
 * strictly 1-to-1 media — nobody is actually joined into the WebRTC
 * connection yet. Only friends who are online are offered, since answering
 * an invite to a call already in progress only makes sense if they're
 * actually reachable right now (unlike starting a fresh 1-to-1 call, which
 * rings even for an offline friend).
 */
export default function AddPeoplePanel({ open, onClose }) {
  const call = useCall();
  const [state, setState] = useState({ loading: true, error: "", friends: [] });
  const [busyId, setBusyId] = useState(null);
  const [sentIds, setSentIds] = useState(() => new Set());

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ loading: true, error: "", friends: [] });
    getOnlineFriendsForCall()
      .then((friends) => active && setState({ loading: false, error: "", friends }))
      .catch(() => active && setState({ loading: false, error: "Couldn't load your online friends.", friends: [] }));
    return () => {
      active = false;
    };
  }, [open]);

  if (!call?.peer) return null;

  // Only the other real participant is excluded outright — everyone already
  // invited stays visible with their current status (below) instead of
  // disappearing the moment "Invite" is tapped, which is the confirmation
  // the button's own "Sent" state is there to give.
  const eligible = state.friends.filter((friend) => friend.id !== call.peer.id);
  const inviteStatus = new Map((call.participantInvites || []).map((item) => [item.userId, item.status]));

  const invite = async (friend) => {
    setBusyId(friend.id);
    const result = await call.sendParticipantInvite(friend.id);
    if (result.ok) setSentIds((current) => new Set(current).add(friend.id));
    else setState((current) => ({ ...current, error: result.message }));
    setBusyId(null);
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-96">
      <DialogBackdrop transition className="fixed inset-0 bg-black/50 transition-opacity duration-150 data-[closed]:opacity-0" />
      <div className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <DialogPanel
          transition
          className="call-scope flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-2xl border-t transition duration-150 data-[closed]:translate-y-4 data-[closed]:opacity-0 sm:max-w-sm sm:rounded-2xl sm:border"
          style={{ background: "var(--call-panel-strong)", borderColor: "var(--call-line)" }}
        >
          <div className="flex items-center justify-between border-b p-3.5" style={{ borderColor: "var(--call-line)" }}>
            <DialogTitle className="text-sm font-bold" style={{ color: "var(--call-ink)" }}>Add people</DialogTitle>
            <button type="button" aria-label="Close" onClick={onClose} style={{ color: "var(--call-muted)" }}>
              <Close fontSize="small" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5">
            {state.loading && <p className="py-8 text-center text-xs" style={{ color: "var(--call-muted)" }}>Loading…</p>}
            {state.error && <p className="py-2 text-center text-xs font-medium" style={{ color: "var(--call-danger)" }}>{state.error}</p>}
            {!state.loading && !eligible.length && (
              <p className="py-8 text-center text-xs" style={{ color: "var(--call-muted)" }}>
                None of your friends are online right now.
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {eligible.map((friend) => {
                const status = inviteStatus.get(friend.id);
                const sent = sentIds.has(friend.id) || Boolean(status);
                const label = status === "accepted" ? "Accepted" : status === "declined" ? "Declined" : sent ? "Sent" : "Invite";
                return (
                  <li key={friend.id} className="flex items-center gap-3 rounded-xl p-2" style={{ background: "var(--call-panel)" }}>
                    <Avatar person={friend} size="md" />
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: "var(--call-ink)" }}>{friend.fullName}</p>
                    <button
                      type="button"
                      disabled={sent || busyId === friend.id}
                      onClick={() => invite(friend)}
                      className="flex min-h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-bold disabled:opacity-60"
                      style={{ background: sent ? "var(--call-line)" : "var(--accent)", color: sent ? "var(--call-ink)" : "#fff" }}
                      data-testid="add-people-invite"
                    >
                      <PersonAddAlt1 fontSize="small" />
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
