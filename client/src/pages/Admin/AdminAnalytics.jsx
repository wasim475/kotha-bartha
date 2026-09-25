import { useState } from "react";

import AdminButton from "../../components/admin/AdminButton";
import AdminChip from "../../components/admin/AdminChip";
import AdminBarChart from "../../components/admin/AdminBarChart";
import AdminDataTable from "../../components/admin/AdminDataTable";
import AdminPage from "../../components/admin/AdminPage";
import AdminStatCard from "../../components/admin/AdminStatCard";
import { formatDuration, pageLabel } from "../../components/admin/analyticsFormat";
import Card from "../../components/ui/Card";
import useAdminAnalytics, { useAdminPageAnalytics } from "../../hooks/admin/useAdminAnalytics";

const RANGES = [
  ["today", "Today"],
  ["week", "This Week"],
  ["month", "This Month"],
];
const RANGE_LABEL = Object.fromEntries(RANGES);

// Time is shown only where at least one visit was measured — older visits have no duration, and 0s would claim otherwise.
const activeTime = (row) => (row?.measuredViews ? formatDuration(row.totalSeconds) : "—");

/** One page's numbers for all three periods side by side. */
function PageDetail({ page, onClose }) {
  const detail = useAdminPageAnalytics(page);
  const d = detail.data;
  return (
    <Card className="flex min-w-0 flex-col gap-3" data-testid="admin-page-detail">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-ink">{pageLabel(page)}</h3>
        <AdminButton variant="outline" onClick={onClose} aria-label="Close page details">
          Close
        </AdminButton>
      </div>
      {detail.error && <p className="text-sm text-danger" role="alert">{detail.error}</p>}
      <div className="grid gap-3 md:grid-cols-3">
        {RANGES.map(([key, label]) => (
          <div key={key} className="min-w-0 rounded-lg border border-line bg-soft/40 p-3">
            <p className="text-[11px] font-bold tracking-wide text-muted uppercase">{label}</p>
            {detail.loading ? (
              <div className="mt-2 h-24 animate-pulse rounded bg-soft motion-reduce:animate-none" aria-label="Loading" />
            ) : d ? (
              <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted">Unique users</dt>
                <dd className="font-semibold text-ink tabular-nums">{d[key].users.toLocaleString()}</dd>
                <dt className="text-muted">Views</dt>
                <dd className="font-semibold text-ink tabular-nums">{d[key].views.toLocaleString()}</dd>
                <dt className="text-muted">Total active time</dt>
                <dd className="font-semibold text-ink tabular-nums">{activeTime(d[key])}</dd>
                <dt className="text-muted">Average session</dt>
                <dd className="font-semibold text-ink tabular-nums">{formatDuration(d[key].avgSeconds)}</dd>
              </dl>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

/** /admin/analytics — usage, aggregated on the server for Today / This Week / This Month. */
export default function AdminAnalytics() {
  const [range, setRange] = useState("today");
  const [selected, setSelected] = useState(null);
  const stats = useAdminAnalytics(range);
  const d = stats.data;
  const topMax = Math.max(...(d?.topPages.map((page) => page.views) || [1]), 1);

  return (
    <AdminPage
      title="Analytics"
      subtitle="Visits and activity across Kotha-Barta."
      actions={
        <div className="flex gap-1.5" role="group" aria-label="Time range">
          {RANGES.map(([key, label]) => (
            <AdminChip key={key} active={range === key} onClick={() => setRange(key)}>
              {label}
            </AdminChip>
          ))}
        </div>
      }
    >
      {stats.error && <Card className="text-sm text-danger" role="alert">{stats.error}</Card>}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <AdminStatCard label="Visitors" loading={stats.loading} value={d?.totals.visitors} hint="Distinct sessions" />
        <AdminStatCard label="New users" loading={stats.loading} value={d?.totals.newUsers} />
        <AdminStatCard label="Active users" loading={stats.loading} value={d?.totals.activeUsers} hint="Signed in" />
        <AdminStatCard label="Page views" loading={stats.loading} value={d?.totals.pageViews} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <AdminStatCard label="Daily active" loading={stats.loading} value={d?.active.daily} hint="Last 24 hours" />
        <AdminStatCard label="Weekly active" loading={stats.loading} value={d?.active.weekly} hint="Last 7 days" />
        <AdminStatCard label="Monthly active" loading={stats.loading} value={d?.active.monthly} hint="Last 30 days" />
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="engagement-heading" data-testid="admin-engagement">
        <div>
          <h2 id="engagement-heading" className="font-display text-lg font-semibold text-ink">User engagement</h2>
          <p className="text-xs text-muted">Active time only: the tab is open in front and the person is interacting. Visits from before time tracking began have no duration and are left out.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <AdminStatCard label="Total active time" loading={stats.loading} display={activeTime(d?.engagement)} hint={RANGE_LABEL[range]} />
          <AdminStatCard label="Avg session" loading={stats.loading} display={formatDuration(d?.engagement.avgSeconds)} hint={d ? `${d.engagement.measuredViews.toLocaleString()} measured visits` : ""} />
          <AdminStatCard label="Median session" loading={stats.loading} display={formatDuration(d?.engagement.medianSeconds)} hint="Typical visit" />
          <AdminStatCard label="Active users" loading={stats.loading} value={d?.totals.activeUsers} hint="Signed in" />
        </div>
        <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-3">
          {RANGES.map(([key, label]) => (
            <AdminStatCard key={key} label={`Active time · ${label}`} loading={stats.loading} display={formatDuration(d?.engagement.periodTotals[key])} />
          ))}
        </div>
      </section>

      <Card className="flex min-w-0 flex-col gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">Page views {range === "today" ? "by hour" : "by day"}</h2>
        {stats.loading ? <div className="h-40 animate-pulse rounded bg-soft motion-reduce:animate-none" /> : <AdminBarChart series={d?.series} />}
      </Card>

      <Card className="flex min-w-0 flex-col gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">Most visited pages</h2>
        {stats.loading ? (
          <div className="h-32 animate-pulse rounded bg-soft motion-reduce:animate-none" />
        ) : !d?.topPages.length ? (
          <p className="py-6 text-center text-sm text-muted">No page views recorded in this period yet.</p>
        ) : (
          <ol className="flex flex-col gap-2.5" data-testid="admin-top-pages">
            {d.topPages.map((page) => (
              <li key={page.page} className="min-w-0">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-semibold text-ink">{pageLabel(page.page)}</span>
                  <span className="shrink-0 text-xs text-muted tabular-nums">
                    {page.views.toLocaleString()} views · {page.users} users
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-soft" aria-hidden="true">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(page.views / topMax) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <section className="flex min-w-0 flex-col gap-3" aria-labelledby="page-engagement-heading" data-testid="admin-page-engagement">
        <div>
          <h2 id="page-engagement-heading" className="font-display text-lg font-semibold text-ink">Most engaged pages</h2>
          <p className="text-xs text-muted">Pages ordered by total active time in this period — a view of pages, not of people.</p>
        </div>
        <AdminDataTable
          loading={stats.loading}
          error={stats.error}
          rows={d?.pageEngagement}
          getKey={(row) => row.page}
          empty="No time has been recorded in this period yet."
          columns={[
            { key: "rank", header: "Rank", className: "w-14 tabular-nums text-muted", render: (row) => d.pageEngagement.indexOf(row) + 1 },
            { key: "page", header: "Page", className: "font-semibold text-ink", render: (row) => pageLabel(row.page) },
            { key: "users", header: "Unique users", className: "tabular-nums", render: (row) => row.users.toLocaleString() },
            { key: "views", header: "Page views", className: "tabular-nums", render: (row) => row.views.toLocaleString() },
            { key: "time", header: "Active time", className: "tabular-nums", render: (row) => activeTime(row) },
            { key: "avg", header: "Avg time", className: "tabular-nums", render: (row) => formatDuration(row.avgSeconds) },
            {
              key: "details",
              header: "Details",
              render: (row) => (
                <AdminButton variant="outline" onClick={() => setSelected(row.page)} aria-label={`Details for ${pageLabel(row.page)}`}>
                  View
                </AdminButton>
              ),
            },
          ]}
        />
        {selected && <PageDetail page={selected} onClose={() => setSelected(null)} />}
      </section>
    </AdminPage>
  );
}
