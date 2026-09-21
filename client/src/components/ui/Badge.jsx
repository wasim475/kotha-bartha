import { cx } from "../../utility/cx";

const variants = {
  accent: "bg-accent text-white",
  danger: "bg-danger text-white",
  neutral: "bg-soft text-muted",
};

/**
 * Small pill used for unread counts, status labels ("Friend"), and
 * notification dots. Pass `dot` for a bare colored dot with no text
 * (unread indicators) instead of a labeled pill.
 */
export default function Badge({
  children,
  variant = "accent",
  dot = false,
  className = "",
}) {
  if (dot) {
    return (
      <span
        aria-hidden="true"
        className={cx(
          "inline-block size-2 rounded-full",
          variant === "danger" ? "bg-danger" : "bg-accent",
          className,
        )}
      />
    );
  }

  return (
    <span
      className={cx(
        "inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
        variants[variant] || variants.accent,
        className,
      )}
    >
      {children}
    </span>
  );
}
