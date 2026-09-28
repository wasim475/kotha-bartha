import { GroupAddOutlined } from "@mui/icons-material";
import { AnimatePresence, motion as Motion, useReducedMotion } from "framer-motion";

import Avatar from "../../components/ui/Avatar";
import Button from "../../components/ui/Button";
import { useCall } from "../../provider/CallProvider";
import useButtonColorFix from "../../utility/useButtonColorFix";

/**
 * "Add People" foundation — a global popup for being invited to join
 * someone else's already-active call, shown regardless of which page this
 * person is on (same pattern as IncomingCallPopup). Accepting does NOT open
 * a call screen here: the call stays 1-to-1 media (see server/src/models/Call.js),
 * so the person is told that plainly instead — this just establishes the
 * invitation UI/authorization foundation for when group media exists.
 */
export default function ParticipantInvitePopup() {
  const call = useCall();
  const reduced = useReducedMotion();
  const invite = call?.participantInvite;
  const primaryFix = useButtonColorFix("primary");
  const outlineFix = useButtonColorFix("outline");

  return (
    <div aria-live="assertive" className="pointer-events-none fixed inset-x-0 top-[calc(var(--topbar-h,72px)+8px)] z-95 flex flex-col items-center gap-2 px-3 sm:items-end sm:pr-4">
      <AnimatePresence initial={false}>
        {invite && (
          <Motion.div
            key="participant-invite"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            role="alertdialog"
            aria-label={`${invite.inviter?.fullName || "A friend"} invited you to join a video call`}
            data-testid="participant-invite"
            className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border shadow-[0_18px_50px_-12px_rgba(0,0,0,0.5)]"
            style={{ background: "var(--call-panel-strong)", borderColor: "var(--call-line)" }}
          >
            <div className="flex items-center gap-3 p-3.5">
              <Avatar person={invite.inviter} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold tracking-wide uppercase" style={{ color: "var(--call-muted)" }}>Invited to join a call</p>
                <p className="truncate text-sm font-bold" style={{ color: "var(--call-ink)" }}>{invite.inviter?.fullName || "A friend"}</p>
              </div>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: "var(--call-line)" }} aria-hidden="true">
                <GroupAddOutlined fontSize="small" />
              </span>
            </div>
            <div className="flex gap-2 px-3.5 pb-3.5">
              <Button variant="outline" size="sm" className="min-h-11 min-w-0 flex-1" onClick={() => call.respondToParticipantInvite(false)} style={outlineFix.style} onMouseEnter={outlineFix.onMouseEnter} onMouseLeave={outlineFix.onMouseLeave} data-testid="participant-invite-decline">
                Decline
              </Button>
              <Button variant="primary" size="sm" className="min-h-11 min-w-0 flex-1" onClick={() => call.respondToParticipantInvite(true)} style={primaryFix.style} onMouseEnter={primaryFix.onMouseEnter} onMouseLeave={primaryFix.onMouseLeave} data-testid="participant-invite-accept">
                Accept
              </Button>
            </div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
