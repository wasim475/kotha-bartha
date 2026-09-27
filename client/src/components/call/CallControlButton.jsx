// A circular call-control button (mic, camera, end-call, ...). Written with
// inline styles rather than Tailwind background/border utilities because a
// pre-existing app-wide `button { border: 0; background: transparent; color:
// inherit }` reset (see utility/useButtonColorFix.js's own comment) beats
// unlayered utility classes on every new button — this is the same fix,
// just against the call UI's own dark palette instead of the light/dark
// theme tokens.
const TONES = {
  neutral: { background: "var(--call-panel)", color: "var(--call-ink)" },
  active: { background: "color-mix(in srgb, var(--accent) 85%, black)", color: "#fff" },
  off: { background: "#fff", color: "#111" },
  danger: { background: "var(--call-danger)", color: "#fff" },
};

export default function CallControlButton({ tone = "neutral", size = 52, label, icon, badge, className = "", ...rest }) {
  const palette = TONES[tone] || TONES.neutral;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={tone === "active" || tone === "off" ? true : undefined}
      title={label}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full shadow-lg transition-transform motion-safe:duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-92 ${className}`}
      style={{ width: size, height: size, background: palette.background, color: palette.color, border: "none" }}
      {...rest}
    >
      {icon}
      {badge != null && (
        <span
          className="absolute -top-1 -right-1 grid min-w-4.5 place-items-center rounded-full px-1 text-[10px] font-bold"
          style={{ background: "var(--call-danger)", color: "#fff" }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
