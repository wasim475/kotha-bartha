import { useState } from "react";
import { Link } from "react-router-dom";

import AdminButton from "../../components/admin/AdminButton";
import AdminConfirmDialog from "../../components/admin/AdminConfirmDialog";
import AdminPagination from "../../components/admin/AdminPagination";
import AdminStatCard from "../../components/admin/AdminStatCard";
import { Pill } from "../../components/admin/AdminUserStatus";
import { SkeletonLines } from "../../components/admin/AdminLoadingSkeleton";
import Card from "../../components/ui/Card";
import useAdminAction from "../../hooks/admin/useAdminAction";
import { useAdminUserTab } from "../../hooks/admin/useAdminUsers";
import { formatTime } from "../../utility/helpers";

const STATUS_LABEL = { visible: "Visible", hidden: "Hidden (banned)", deleted: "Deleted" };

function TabState({ query, empty, children }) {
  if (query.loading) return <SkeletonLines rows={4} />;
  if (query.error) return <Card className="text-sm text-danger" role="alert">{query.error}</Card>;
  if (!query.data) return null;
  if (query.data.items && !query.data.items.length) return <Card className="py-8 text-center text-sm text-muted" data-testid="admin-empty">{empty}</Card>;
  return children;
}

/** Posts or comments/replies of one user, one page at a time, each with a Delete. */
export function ContentTab({ userId, tab, type, active }) {
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null);
  const action = useAdminAction();
  const extra = tab === "comments" ? { type } : undefined;
  const query = useAdminUserTab(userId, tab, { page, extra, enabled: active });
  const isPost = tab === "posts";
  const noun = isPost ? "post" : type === "reply" ? "reply" : "comment";

  const remove = async () => {
    if (await action.run("DELETE", `/admin/${isPost ? "posts" : "comments"}/${target.id}`)) {
      setTarget(null);
      query.reload();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <TabState query={query} empty={`No ${noun}s.`}>
        <ul className="flex flex-col gap-2.5">
          {query.data?.items.map((item) => (
            <li key={item.id}>
              <Card className="flex min-w-0 flex-col gap-2" data-testid="admin-user-item">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span>{formatTime(item.createdAt)}</span>
                  <Pill tone={item.status}>{STATUS_LABEL[item.status]}</Pill>
                </div>
                {item.body && <p className="text-sm wrap-break-word text-ink">{item.body}</p>}
                {isPost && item.mediaCount > 0 && <p className="text-xs text-muted">{item.mediaCount} photo(s)</p>}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted">{isPost ? `${item.comments} comments · ${item.reactions} reactions` : "On a post"}</p>
                  <div className="flex gap-2">
                    <Link to={`/admin/posts/${isPost ? item.id : item.postId}`} className="inline-flex min-h-10 items-center rounded-md border border-line bg-panel px-3.5 text-xs font-semibold text-ink hover:bg-soft">
                      View
                    </Link>
                    {item.status !== "deleted" && (
                      <AdminButton variant="danger" className="min-h-10" onClick={() => { action.clearError(); setTarget(item); }}>
                        Delete
                      </AdminButton>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </TabState>
      {query.data && <AdminPagination page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onPage={setPage} noun={`${noun}s`} disabled={query.loading} />}
      <AdminConfirmDialog
        open={Boolean(target)}
        title={`Delete this ${noun}?`}
        description={isPost ? "The post disappears for everyone, with its photos and notifications." : "It is deleted together with any replies under it."}
        confirmLabel={`Delete ${noun}`}
        variant="danger"
        busy={action.busy}
        error={action.error}
        onConfirm={remove}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}

/** Quiz / game / leaderboard numbers. */
export function ActivityTab({ userId, active }) {
  const query = useAdminUserTab(userId, "activity", { enabled: active });
  const d = query.data;
  return (
    <div className="flex flex-col gap-3">
      {query.error && <Card className="text-sm text-danger" role="alert">{query.error}</Card>}
      <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 xl:grid-cols-3">
        <AdminStatCard label="Quiz attempts" loading={query.loading} value={d?.quiz.attempts} hint={`${d?.quiz.points ?? 0} leaderboard points`} />
        <AdminStatCard label="Single-player games" loading={query.loading} value={d?.games.attempts} hint={`${d?.games.points ?? 0} points`} />
        <AdminStatCard label="Tic-Tac-Toe played" loading={query.loading} value={d?.games.ticTacToe.played} hint={`${d?.games.ticTacToe.wins ?? 0} wins · ${d?.games.ticTacToe.points ?? 0} points`} />
        <AdminStatCard label="Friend challenges" loading={query.loading} value={d?.games.challenges.played} hint={`${d?.games.challenges.wins ?? 0} wins · ${d?.games.challenges.points ?? 0} points`} />
        <AdminStatCard label="Leaderboard points" loading={query.loading} value={d?.leaderboard.totalPoints} hint={d ? (d.leaderboard.ranked ? "Ranked" : "Not ranked (banned, staff or deleted)") : ""} />
      </div>
    </div>
  );
}

/** Reports about this user, or filed by them. */
export function ReportsTab({ userId, active }) {
  const [direction, setDirection] = useState("against");
  const [page, setPage] = useState(1);
  const extra = { direction };
  const query = useAdminUserTab(userId, "reports", { page, extra, enabled: active });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2" role="group" aria-label="Report direction">
        {[["against", "About this user"], ["by", "Filed by this user"]].map(([key, label]) => (
          <button key={key} type="button" aria-pressed={direction === key} onClick={() => { setDirection(key); setPage(1); }} className={`min-h-10 rounded-full border px-3.5 text-xs font-semibold ${direction === key ? "border-accent bg-accent/12 text-accent" : "border-line bg-panel text-muted"}`}>
            {label}
          </button>
        ))}
      </div>
      <TabState query={query} empty="No reports.">
        <ul className="flex flex-col gap-2.5">
          {query.data?.items.map((report) => (
            <li key={report.id}>
              <Link to={`/admin/reports/${report.id}`} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-accent">
                <Card interactive className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 text-sm text-ink">
                    <strong className="capitalize">{report.targetType}</strong> · {report.reason}
                    <span className="block text-xs text-muted">{formatTime(report.createdAt)}</span>
                  </span>
                  <Pill tone={report.status}>{report.status}</Pill>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </TabState>
      {query.data && <AdminPagination page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onPage={setPage} noun="reports" disabled={query.loading} />}
    </div>
  );
}
