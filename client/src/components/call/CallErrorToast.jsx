import { Close } from "@mui/icons-material";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { useEffect } from "react";

import { useCall } from "../../provider/CallProvider";

const AUTO_DISMISS_MS = 6000;

/**
 * A call error (camera denied, declined, failed to connect, ...) used to
 * only render inside ActiveCall — invisible for exactly the moments that
 * matter most, since the call screen itself unmounts the instant the call
 * ends (e.g. right when a connection failure is reported). Mounted here
 * instead, alongside the rest of CallGlobalHost, so it's visible on
 * whatever page the person is on, independent of whether a call is active.
 */
export default function CallErrorToast() {
  const call = useCall();
  const message = call?.error;

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => call.dismissError(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message, call]);

  return (
    <div aria-live="assertive" className="pointer-events-none fixed inset-x-0 bottom-4 z-95 flex justify-center px-3">
      <AnimatePresence>
        {message && (
          <Motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            role="alert"
            className="pointer-events-auto flex max-w-sm items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-medium shadow-[0_18px_50px_-12px_rgba(0,0,0,0.5)]"
            style={{ background: "var(--call-panel-strong)", color: "var(--call-ink)" }}
          >
            {message}
            <button type="button" aria-label="Dismiss" onClick={call.dismissError}>
              <Close fontSize="small" />
            </button>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
