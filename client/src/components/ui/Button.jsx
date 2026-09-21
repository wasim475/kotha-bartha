import { forwardRef } from "react";

import { cx } from "../../utility/cx";
import Spinner from "./Spinner";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold " +
  "transition-colors motion-safe:duration-150 disabled:cursor-not-allowed disabled:opacity-55 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const variants = {
  primary:
    "bg-accent text-white shadow-sm hover:bg-accent-deep active:bg-accent-deep",
  outline:
    "border border-line bg-panel text-ink hover:bg-soft active:bg-soft",
  ghost: "bg-transparent text-muted hover:bg-soft hover:text-ink active:bg-soft",
  danger:
    "bg-danger text-white shadow-sm hover:bg-danger-deep active:bg-danger-deep",
};

const sizes = {
  sm: "h-9 px-3.5 text-xs",
  md: "h-11 px-4.5 text-sm",
};

const Button = forwardRef(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    className = "",
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        base,
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        className,
      )}
      {...rest}
    >
      {loading && <Spinner size={size === "sm" ? "xs" : "sm"} />}
      {children}
    </button>
  );
});

export default Button;
