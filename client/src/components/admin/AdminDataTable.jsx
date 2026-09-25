import Card from "../ui/Card";
import { SkeletonLines } from "./AdminLoadingSkeleton";

/**
 * A table on wide screens that becomes a stack of cards on narrow ones, so nothing
 * scrolls sideways on a phone. `columns` are { key, header, render(row), className }.
 * `renderCard(row)` draws a row as a card on small screens (falls back to a
 * label/value list built from the columns).
 */
export default function AdminDataTable({ columns, rows, loading, empty = "Nothing to show.", getKey = (row) => row.id, renderCard, error }) {
  if (loading) return <SkeletonLines rows={6} />;
  if (error) {
    return (
      <Card className="text-center text-sm text-danger" role="alert">
        {error}
      </Card>
    );
  }
  if (!rows?.length) {
    return (
      <Card className="py-10 text-center text-sm text-muted" data-testid="admin-empty">
        {empty}
      </Card>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-line bg-panel shadow-soft lg:block">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-soft text-[11px] font-bold tracking-wide text-muted uppercase">
              {columns.map((column) => (
                <th key={column.key} scope="col" className={`px-3 py-2.5 ${column.className || ""}`}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={getKey(row)} className="border-b border-line last:border-b-0 hover:bg-soft/60" data-testid="admin-row">
                {columns.map((column) => (
                  <td key={column.key} className={`px-3 py-2.5 align-middle ${column.className || ""}`}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2.5 lg:hidden">
        {rows.map((row) => (
          <Card key={getKey(row)} className="min-w-0 p-3.5" data-testid="admin-row">
            {renderCard ? (
              renderCard(row)
            ) : (
              <dl className="grid gap-1.5 text-sm">
                {columns.map((column) => (
                  <div key={column.key} className="flex min-w-0 items-start justify-between gap-3">
                    <dt className="shrink-0 text-xs font-semibold text-muted">{column.header}</dt>
                    <dd className="min-w-0 text-right wrap-break-word">{column.render(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
