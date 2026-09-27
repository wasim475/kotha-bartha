import { Videocam, VideocamOff } from "@mui/icons-material";
import { AnimatePresence, motion as Motion, useReducedMotion } from "framer-motion";

import Avatar from "../../components/ui/Avatar";
import Button from "../../components/ui/Button";
import { useCall } from "../../provider/CallProvider";
import useButtonColorFix from "../../utility/useButtonColorFix";

/**
 * The global "incoming call" popup — a small card, not a takeover screen, so
 * it never forces navigation off whatever page the person is already on
 * (Feed, Messages, Friends, Study, Games, ...). Mounted once above every
 * shell (see Router/Main.jsx), same pattern as LudoGlobalHost/TicTacToeGlobalHost.
 */
export default function IncomingCallPopup() {
  const call = useCall();
  const reduced = useReducedMotion();
  const show = call && call.status === "ringing" && call.role === "callee";
  const primaryFix = useButtonColorFix("primary");
  const dangerFix = useButtonColorFix("danger");

  return (
    <div aria-live="assertive" className="pointer-events-none fixed inset-x-0 top-[calc(var(--topbar-h,72px)+8px)] z-95 flex flex-col items-center gap-2 px-3 sm:items-end sm:pr-4">
      <AnimatePresence initial={false}>
        {show && (
          <Motion.div
            key="incoming-call"
            layout={!reduced}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            role="alertdialog"
            aria-label={`Incoming ${call.video ? "video " : ""}call from ${call.peer?.fullName || "a friend"}`}
            data-testid="call-incoming"
            className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border shadow-[0_18px_50px_-12px_rgba(0,0,0,0.5)]"
            style={{ background: "var(--call-panel-strong)", borderColor: "var(--call-line)" }}
          >
            <div className="flex items-center gap-3 p-3.5">
              <span className="call-incoming-ring call-avatar-breathe rounded-full">
                <Avatar person={call.peer} size="md" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold tracking-wide uppercase" style={{ color: "var(--call-muted)" }}>
                  Incoming {call.video ? "video" : "audio"} call
                </p>
                <p className="truncate text-sm font-bold" style={{ color: "var(--call-ink)" }} data-testid="call-incoming-name">
                  {call.peer?.fullName || "A friend"}
                </p>
              </div>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: "var(--call-line)" }} aria-hidden="true">
                {call.video ? <Videocam fontSize="small" /> : <VideocamOff fontSize="small" />}
              </span>
            </div>

            <div className="flex gap-2 px-3.5 pb-3.5">
              <Button variant="danger" size="sm" className="min-h-11 min-w-0 flex-1" onClick={call.decline} style={dangerFix.style} onMouseEnter={dangerFix.onMouseEnter} onMouseLeave={dangerFix.onMouseLeave} data-testid="call-decline">
                Decline
              </Button>
              <Button variant="primary" size="sm" className="min-h-11 min-w-0 flex-1" onClick={call.accept} style={primaryFix.style} onMouseEnter={primaryFix.onMouseEnter} onMouseLeave={primaryFix.onMouseLeave} data-testid="call-accept">
                Accept
              </Button>
            </div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
