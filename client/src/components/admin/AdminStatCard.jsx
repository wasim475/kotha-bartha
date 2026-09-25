import Card from "../ui/Card";

/**
 * One headline number. While `loading` it shows a skeleton — never a zero — so a
 * number on screen is always the server's real answer.
 */
export default function AdminStatCard({ label, value, display, hint, icon, loading, tone }) {
  return (
    <Card className="flex min-w-0 items-start gap-3" data-testid="admin-stat" data-loading={loading ? "true" : "false"}>
      {icon && (
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-soft text-accent" aria-hidden="true">
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-bold tracking-wide text-muted uppercase">{label}</p>
        {loading ? (
          <div className="mt-1.5 h-7 w-20 animate-pulse rounded bg-soft motion-reduce:animate-none" aria-label="Loading" />
        ) : (
          <p className={`mt-0.5 font-display text-2xl font-semibold tabular-nums ${tone || "text-ink"}`}>{display ?? Number(value ?? 0).toLocaleString()}</p>
        )}
        {hint && <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>}
      </div>
    </Card>
  );
}
