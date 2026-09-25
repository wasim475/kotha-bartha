import { cx } from "../../utility/cx";

// The app's unlayered `button { border: 0; background: transparent }` reset beats
// utility classes (see utility/useButtonColorFix.js), so a chip's border and fill
// are set inline — an inline style always wins.
const style = (active) => ({
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: active ? "var(--accent)" : "var(--line)",
  backgroundColor: active ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--panel)",
  color: active ? "var(--accent)" : "var(--muted)",
});

/** A pill-shaped toggle for filters and tabs. `role` may be "tab" (then `active` is aria-selected). */
export default function AdminChip({ active, role, className, children, ...rest }) {
  return (
    <button
      type="button"
      role={role}
      {...(role === "tab" ? { "aria-selected": active } : { "aria-pressed": active })}
      className={cx("min-h-10 rounded-full px-3.5 text-xs font-semibold whitespace-nowrap transition-colors hover:text-ink", className)}
      style={style(active)}
      {...rest}
    >
      {children}
    </button>
  );
}
