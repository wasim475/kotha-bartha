import { AnimatePresence, motion as Motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

import { ludoHaptics, ludoSfx } from "../../../../../utility/ludoSound";

/**
 * "3 · 2 · 1 · GO!" before the first turn. It only DISPLAYS the time left until
 * the server's start moment (`startsAt`, corrected by the server clock offset) —
 * the server refuses moves before then, whatever this shows.
 */
export default function Countdown({ startsAt, offsetMs = 0 }) {
  const reduced = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  const remaining = startsAt - (now + offsetMs);
  const label = remaining > 2400 ? "3" : remaining > 1200 ? "2" : remaining > 0 ? "1" : remaining > -700 ? "GO!" : null;

  useEffect(() => {
    if (remaining <= -700) return undefined;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [remaining]);

  useEffect(() => {
    if (!label) return;
    ludoSfx.countdown(label === "GO!");
    if (label === "GO!") ludoHaptics.dice();
  }, [label]);

  if (!label) return null;
  return (
    <div className="ludo-overlay ludo-scope" style={{ background: "color-mix(in srgb, #000 45%, transparent)", pointerEvents: "none" }} role="status" aria-live="assertive" data-testid="ludo-countdown">
      <AnimatePresence mode="wait">
        <Motion.div
          key={label}
          className="ludo-count"
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.6 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          {label}
        </Motion.div>
      </AnimatePresence>
    </div>
  );
}
