import { forwardRef } from "react";

import { cx } from "../../utility/cx";

const base =
  "inline-flex shrink-0 items-center justify-center rounded-full transition-colors " +
  "motion-safe:duration-150 disabled:cursor-not-allowed disabled:opacity-55 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const variants = {
  default: "text-muted hover:bg-soft hover:text-ink active:bg-soft",
  accent: "text-accent hover:bg-soft active:bg-soft",
  danger: "text-danger hover:bg-danger-soft active:bg-danger-soft",
  solid: "bg-accent text-white hover:bg-accent-deep active:bg-accent-deep",
};

const sizes = {
  sm: "size-9 [&_svg]:text-[18px]",
  md: "size-11 [&_svg]:text-[20px]",
};

/**
 * Icon-only control. `label` is required and doubles as the accessible
 * name (aria-label) and the native tooltip (title) since these buttons
 * never carry visible text.
 */
const IconButton = forwardRef(function IconButton(
  {
    label,
    icon,
    variant = "default",
    size = "md",
    active = false,
    className = "",
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      className={cx(
        base,
        variants[variant] || variants.default,
        sizes[size] || sizes.md,
        active && "bg-soft text-accent",
        className,
      )}
      {...rest}
    >
      {icon || children}
    </button>
  );
});

export default IconButton;
