import { useEffect, useState } from "react";

// Lightweight mount/unmount transition helper for hand-rolled floating UI
// (portal-rendered popovers/toasts that aren't built on Headless UI's
// Transition). Keeps the node mounted for `duration` ms after `active`
// goes false so an exit CSS transition can finish, and flips `visible` one
// frame after mount so an enter transition has a "from" state to animate
// from. Respects prefers-reduced-motion by collapsing the duration to 0.
export default function useMountedTransition(active, duration = 150) {
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const effectiveDuration = reducedMotion ? 0 : duration;

  const [shouldRender, setShouldRender] = useState(active);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let raf;
    let timeout;

    // Deferred a microtask so the state updates below aren't literally the
    // first synchronous statements of the effect body.
    queueMicrotask(() => {
      if (active) {
        setShouldRender(true);
        raf = requestAnimationFrame(() => setVisible(true));
      } else {
        setVisible(false);
        timeout = setTimeout(() => setShouldRender(false), effectiveDuration);
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [active, effectiveDuration]);

  return { shouldRender, visible };
}
