import { cx } from "../../../utility/cx";

/**
 * A compact pill-style filter group (category / period / audience). Wraps
 * horizontally on narrow screens instead of overflowing — options are
 * short enough (2-3 words max) to never need horizontal scrolling even at
 * 320px.
 */
export default function SegmentedControl({ ariaLabel, options, value, onChange }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap items-center gap-1 rounded-full border border-line bg-panel p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cx(
            "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors motion-safe:duration-150 sm:px-3",
            value === option.value ? "bg-accent text-white" : "text-muted hover:text-ink",
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
