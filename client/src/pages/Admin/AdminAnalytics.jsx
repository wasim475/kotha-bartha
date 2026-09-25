import { useState } from "react";

import AdminChip from "../../components/admin/AdminChip";
import AdminBarChart from "../../components/admin/AdminBarChart";
import AdminPage from "../../components/admin/AdminPage";
import AdminStatCard from "../../components/admin/AdminStatCard";
import Card from "../../components/ui/Card";
import useAdminAnalytics from "../../hooks/admin/useAdminAnalytics";

const RANGES = [
  ["today", "Today"],
  ["week", "This Week"],
  ["month", "This Month"],
];

const PAGE_LABEL = {
  feed: "Feed",
  messages: "Messages",
  friends: "Friends",
  notifications: "Notifications",
  profile: "Profile",
  post: "Single post",
  "study/blogs": "Study · Blogs",
  "study/quiz": "Study · Quiz",
  "study/class-study": "Study · Class Study",
  "study/games": "Study · Games",
  "study/leaderboard": "Study · Leaderboard",
  "study/other": "Study · Other",
  admin: "Admin Panel",
  auth: "Login / Sign up",
  other: "Other",
};

/** /admin/analytics — usage, aggregated on the server for Today / This Week / This Month. */
export default function AdminAnalytics() {
  const [range, setRange] = useState("today");
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
                  <span className="min-w-0 truncate font-semibold text-ink">{PAGE_LABEL[page.page] || page.page}</span>
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
    </AdminPage>
  );
}
