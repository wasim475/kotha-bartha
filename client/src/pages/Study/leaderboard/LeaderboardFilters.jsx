/**
 * A single labeled dropdown filter (Category / Period). Replaces the
 * earlier segmented pill-button group with a compact select — same
 * information, far less visual weight, so the header stays clean at every
 * width instead of needing to wrap several rows of buttons.
 */
export default function LeaderboardSelect({ ariaLabel, label, options, value, onChange }) {
  return (
    <label className="flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-muted shadow-sm transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
      {label}
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent text-xs font-bold text-ink outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
