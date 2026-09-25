// Placeholder blocks while a screen's data loads.
export function SkeletonLines({ rows = 4, className = "" }) {
  return (
    <div aria-busy="true" aria-label="Loading" className={`flex flex-col gap-2.5 ${className}`}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-11 animate-pulse rounded-lg bg-soft motion-reduce:animate-none" style={{ opacity: 1 - index * 0.12 }} />
      ))}
    </div>
  );
}

export default function AdminLoadingSkeleton({ cards = 0, rows = 5 }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      {cards > 0 && (
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: cards }, (_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-lg bg-soft motion-reduce:animate-none" />
          ))}
        </div>
      )}
      <SkeletonLines rows={rows} />
    </div>
  );
}
