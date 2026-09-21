import { useState } from "react";

// Workaround for a pre-existing, app-wide App.css rule — an unscoped
// `button { background: transparent; color: inherit }` reset that isn't
// wrapped in a Tailwind layer, so it silently beats the shared Button
// component's `primary`/`outline`/`danger` background and text colors on
// every button in the app (confirmed on Feed's own buttons too). Fixing
// that reset is a separate, app-wide change; until then, any new Button
// this app adds needs this inline-style workaround to actually show its
// intended color — an inline style always wins over an unlayered class
// rule regardless of cascade order.
const variantStyles = {
  primary: (hover) => ({
    backgroundColor: hover ? "var(--accent-deep)" : "var(--accent)",
    color: "#fff",
  }),
  danger: (hover) => ({
    backgroundColor: hover ? "var(--danger-deep)" : "var(--danger)",
    color: "#fff",
  }),
  outline: (hover) => ({
    backgroundColor: hover ? "var(--soft)" : "var(--panel)",
    color: "var(--ink)",
    borderColor: "var(--line)",
  }),
  ghost: (hover) => ({
    backgroundColor: hover ? "var(--soft)" : "transparent",
    color: "var(--muted)",
  }),
};

export default function useButtonColorFix(variant = "primary") {
  const [hover, setHover] = useState(false);
  const build = variantStyles[variant] || variantStyles.primary;

  return {
    style: build(hover),
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
  };
}
