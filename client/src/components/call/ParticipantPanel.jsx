import { Close, GroupOutlined, Mic, MicOff, Videocam, VideocamOff } from "@mui/icons-material";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { useState } from "react";

import Avatar from "../../components/ui/Avatar";
import { useCall } from "../../provider/CallProvider";
import AddPeoplePanel from "./AddPeoplePanel";

const STATUS_LABEL = { pending: "Invited", accepted: "Accepted", declined: "Declined" };

/**
 * The small "👤 2" indicator in the call's top bar, and the panel it opens.
 * For today's strictly 1-to-1 call this only ever lists the caller and
 * callee, but it's built to also show pending/answered "Add People"
 * invitations (see server/src/models/Call.js) so it reads sensibly once
 * those can actually join — nothing here assumes exactly two participants.
 */
export default function ParticipantPanel({ userId }) {
  const call = useCall();
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  if (!call?.peer) return null;

  // The provider's own call state tracks "peer" + "role" (see CallProvider),
  // not caller/callee directly — "me" is simply whichever end isn't the peer.
  const me = { id: userId, fullName: "You" };
  const participants = [me, call.peer];
  const invites = call.participantInvites || [];

  return (
    <>
      <button
        type="button"
        aria-label="Participants"
        onClick={() => setOpen(true)}
        className="flex min-h-9 items-center gap-1 rounded-full px-2.5 text-xs font-bold"
        style={{ background: "var(--call-panel)", color: "var(--call-ink)" }}
        data-testid="participant-panel-toggle"
      >
        <GroupOutlined fontSize="small" /> {participants.length}
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} className="relative z-96">
        <DialogBackdrop transition className="fixed inset-0 bg-black/50 transition-opacity duration-150 data-[closed]:opacity-0" />
        <div className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <DialogPanel
            transition
            className="call-scope flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-2xl border-t transition duration-150 data-[closed]:translate-y-4 data-[closed]:opacity-0 sm:max-w-sm sm:rounded-2xl sm:border"
            style={{ background: "var(--call-panel-strong)", borderColor: "var(--call-line)" }}
          >
            <div className="flex items-center justify-between border-b p-3.5" style={{ borderColor: "var(--call-line)" }}>
              <DialogTitle className="text-sm font-bold" style={{ color: "var(--call-ink)" }}>In this call</DialogTitle>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} style={{ color: "var(--call-muted)" }}>
                <Close fontSize="small" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5">
              <ul className="flex flex-col gap-2">
                {participants.map((person) => {
                  const isMe = person.id === userId;
                  const micOn = isMe ? call.micOn : call.remoteAudioReady;
                  const cameraOn = isMe ? call.cameraOn : call.video && call.remoteVideoReady;
                  return (
                    <li key={person.id} className="flex items-center gap-3 rounded-xl p-2" style={{ background: "var(--call-panel)" }}>
                      <Avatar person={person} size="md" />
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: "var(--call-ink)" }}>
                        {person.fullName}
                        {isMe && <span className="ml-1 text-xs font-normal" style={{ color: "var(--call-muted)" }}>(you)</span>}
                      </p>
                      <span title={micOn ? "Microphone on" : "Microphone off"} style={{ color: micOn ? "var(--call-ink)" : "var(--call-danger)" }}>
                        {micOn ? <Mic fontSize="small" /> : <MicOff fontSize="small" />}
                      </span>
                      {call.video && (
                        <span title={cameraOn ? "Camera on" : "Camera off"} style={{ color: cameraOn ? "var(--call-ink)" : "var(--call-danger)" }}>
                          {cameraOn ? <Videocam fontSize="small" /> : <VideocamOff fontSize="small" />}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>

              {invites.length > 0 && (
                <>
                  <p className="mt-4 mb-1.5 text-[10px] font-bold tracking-wide uppercase" style={{ color: "var(--call-muted)" }}>Invited</p>
                  <ul className="flex flex-col gap-2">
                    {invites.map((invite) => (
                      <li key={invite.userId} className="flex items-center gap-3 rounded-xl p-2" style={{ background: "var(--call-panel)" }}>
                        <Avatar person={invite.user} size="md" />
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: "var(--call-ink)" }}>{invite.user?.fullName}</p>
                        <span className="text-xs font-semibold" style={{ color: "var(--call-muted)" }}>{STATUS_LABEL[invite.status] || invite.status}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="border-t p-3.5" style={{ borderColor: "var(--call-line)" }}>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold"
                style={{ background: "var(--accent)", color: "#fff" }}
                data-testid="add-people-open"
              >
                Add people
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      <AddPeoplePanel open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
