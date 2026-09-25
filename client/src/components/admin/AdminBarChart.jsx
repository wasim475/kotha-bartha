import { useReducedMotion, motion as Motion } from "framer-motion";

/**
 * A clean, dependency-free bar chart. Each bar is one bucket (an hour or a day);
 * the tallest bar fills the height. The full numbers are also available as a
 * screen-reader table, so the chart never carries information on its own.
 */
export default function AdminBarChart({ series, valueKey = "pageViews", label = "Page views", height = 160 }) {
  const reduced = useReducedMotion();
  if (!series?.length) {
    return <p className="rounded-lg border border-dashed border-line py-10 text-center text-sm text-muted">No activity recorded in this period yet.</p>;
  }
  const max = Math.max(...series.map((point) => point[valueKey]), 1);
  const dense = series.length > 14;

  return (
    <figure className="min-w-0" data-testid="admin-chart">
      <div className="flex items-end gap-1 overflow-hidden" style={{ height }} role="img" aria-label={`${label} over time`}>
        {series.map((point) => (
          <div key={point.bucket} className="group relative flex h-full min-w-0 flex-1 items-end" title={`${point.bucket}: ${point[valueKey]}`}>
            <Motion.div
              className="w-full rounded-t bg-accent/80 group-hover:bg-accent"
              initial={reduced ? false : { height: 0 }}
              animate={{ height: `${Math.max(3, (point[valueKey] / max) * 100)}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted" aria-hidden="true">
        <span>{series[0].bucket}</span>
        {!dense && series.length > 2 && <span>{series[Math.floor(series.length / 2)].bucket}</span>}
        <span>{series[series.length - 1].bucket}</span>
      </div>
      <figcaption className="sr-only">
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th>{label}</th>
            </tr>
          </thead>
          <tbody>
            {series.map((point) => (
              <tr key={point.bucket}>
                <td>{point.bucket}</td>
                <td>{point[valueKey]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
