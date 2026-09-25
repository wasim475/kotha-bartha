import { ArrowBack, OpenInNew } from "@mui/icons-material";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import AdminButton from "../../components/admin/AdminButton";
import AdminComposeDialog from "../../components/admin/AdminComposeDialog";
import AdminConfirmDialog from "../../components/admin/AdminConfirmDialog";
import AdminPage from "../../components/admin/AdminPage";
import AdminThread from "../../components/admin/AdminThread";
import { REASON_LABEL } from "../../components/admin/reportLabels";
import { Pill } from "../../components/admin/AdminUserStatus";
import { SkeletonLines } from "../../components/admin/AdminLoadingSkeleton";
import Avatar from "../../components/ui/Avatar";
import Card from "../../components/ui/Card";
import useAdminAction from "../../hooks/admin/useAdminAction";
import { useAdminReport } from "../../hooks/admin/useAdminReports";
import { formatTime } from "../../utility/helpers";

const CONFIRMS = {
  delete_content: (r) => ({
    title: `Delete the reported ${r.targetType}?`,
    description: r.targetType === "post" ? "The post is deleted for everyone, with its photos and notifications." : "It is deleted together with any replies under it.",
    label: `Delete ${r.targetType}`,
    variant: "danger",
  }),
  ban_user: () => ({
    title: "Ban the reported user?",
    description: "They can still sign in but can't post, comment, react, message, play or edit their profile. Their content is hidden and returns if they are unbanned.",
    label: "Ban user",
    variant: "danger",
  }),
  mute_user: () => ({
    title: "Mute the reported user?",
    description: "They can browse but can't post, comment, message, send friend requests or play interactive games.",
    label: "Mute user",
    variant: "danger",
  }),
  dismiss: () => ({ title: "Dismiss this report?", description: "Nothing is done to the reported content. The report stays on record as dismissed.", label: "Dismiss", variant: "primary" }),
  resolve: () => ({ title: "Mark as resolved?", description: "Use this when the issue has been handled without further action here.", label: "Resolve", variant: "primary" }),
};

const STATE_TEXT = { present: "Present", visible: "Visible", hidden: "Hidden (author banned)", deleted: "Deleted", active: "Account active", banned: "Banned", muted: "Muted" };

/** /admin/reports/:id — the report, the exact place it points at, and the actions. */
export default function AdminReportDetail() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const query = useAdminReport(reportId);
  const action = useAdminAction();
  const [pending, setPending] = useState(null);
  const [compose, setCompose] = useState(null);
  const report = query.data;
  const open = report && ["pending", "reviewing"].includes(report.status);

  const run = async (kind, note) => {
    const result = await action.run("PATCH", `/admin/reports/${reportId}`, { action: kind, note });
    if (result) {
      setPending(null);
      query.reload();
    }
  };
  const ask = (kind) => {
    action.clearError();
    setPending(kind);
  };
  const spec = report && pending ? CONFIRMS[pending](report) : null;

  return (
    <AdminPage
      title="Report"
      actions={
        <AdminButton variant="outline" onClick={() => navigate("/admin/reports")}>
          <ArrowBack fontSize="small" /> All reports
        </AdminButton>
      }
    >
      {query.loading && <SkeletonLines rows={5} />}
      {query.error && (
        <Card className="text-sm text-danger" role="alert">
          {query.error}
        </Card>
      )}
      {report && (
        <>
          <Card className="flex min-w-0 flex-col gap-3" data-testid="admin-report-detail">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-1.5">
                <Pill tone="reviewing">{report.targetType}</Pill>
                <span className="text-base font-semibold text-ink">{REASON_LABEL[report.reason]}</span>
              </span>
              <Pill tone={report.status}>{report.status}</Pill>
            </div>
            {report.description && <p className="rounded-lg bg-soft p-3 text-sm wrap-break-word text-ink">{report.description}</p>}
            <dl className="grid gap-2 text-sm min-[560px]:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-[11px] font-bold tracking-wide text-muted uppercase">Reported by</dt>
                <dd className="flex items-center gap-2">
                  <Avatar person={report.reporter || {}} size="xs" />
                  <Link to={`/admin/users/${report.reporter?.id}`} className="truncate font-semibold hover:underline">
                    {report.reporter?.fullName}
                  </Link>
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] font-bold tracking-wide text-muted uppercase">About</dt>
                <dd className="flex items-center gap-2">
                  <Avatar person={report.reportedUser || {}} size="xs" />
                  <Link to={`/admin/users/${report.reportedUser?.id}`} className="truncate font-semibold hover:underline">
                    {report.reportedUser?.fullName}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold tracking-wide text-muted uppercase">Filed</dt>
                <dd>{formatTime(report.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold tracking-wide text-muted uppercase">Reported item now</dt>
                <dd data-testid="admin-target-state">{STATE_TEXT[report.targetState] || report.targetState}</dd>
              </div>
            </dl>
            {!open && (
              <p className="rounded-lg border border-line p-3 text-sm text-muted" data-testid="admin-resolution">
                <strong className="text-ink capitalize">{report.status}</strong>
                {report.resolutionAction ? ` · ${report.resolutionAction.replace("_", " ")}` : ""}
                {report.resolvedBy ? ` by ${report.resolvedBy.fullName}` : ""} {report.resolvedAt ? formatTime(report.resolvedAt) : ""}
                {report.resolutionNote ? ` — ${report.resolutionNote}` : ""}
              </p>
            )}
          </Card>

          {report.targetType === "user" ? (
            <Card className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-ink">The reported user is {report.reportedUser?.fullName}.</span>
              <Link to={report.links.admin} className="inline-flex min-h-10 items-center rounded-md border border-line bg-panel px-3.5 text-xs font-semibold hover:bg-soft">
                Open user profile
              </Link>
            </Card>
          ) : report.context ? (
            <AdminThread post={report.context.post} comments={report.context.comments} />
          ) : (
            <Card className="text-sm text-muted">The reported {report.targetType} no longer exists. What it said: “{report.snapshot.text}”</Card>
          )}

          <div className="flex flex-wrap gap-2" data-testid="admin-report-actions">
            {open && report.status === "pending" && (
              <AdminButton variant="outline" onClick={() => run("reviewing")} disabled={action.busy}>
                Mark reviewing
              </AdminButton>
            )}
            {open && report.targetType !== "user" && (
              <AdminButton variant="danger" onClick={() => ask("delete_content")}>
                Delete {report.targetType}
              </AdminButton>
            )}
            {open && (
              <>
                <AdminButton variant="danger" onClick={() => ask("ban_user")}>
                  Ban user
                </AdminButton>
                <AdminButton variant="outline" onClick={() => ask("mute_user")}>
                  Mute user
                </AdminButton>
                <AdminButton variant="outline" onClick={() => ask("dismiss")}>
                  Dismiss
                </AdminButton>
                <AdminButton onClick={() => ask("resolve")}>Resolve</AdminButton>
              </>
            )}
            <AdminButton variant="outline" onClick={() => setCompose(report.reporter)}>
              Message reporter
            </AdminButton>
            {report.links?.app && (
              <Link to={report.links.app} className="inline-flex min-h-10 items-center gap-1 rounded-md border border-line bg-panel px-3.5 text-xs font-semibold hover:bg-soft" data-testid="admin-open-in-app">
                <OpenInNew style={{ fontSize: 15 }} /> Open in the app
              </Link>
            )}
          </div>
          {action.error && !pending && (
            <p role="alert" className="text-xs font-medium text-danger">
              {action.error}
            </p>
          )}
        </>
      )}

      <AdminConfirmDialog
        open={Boolean(spec)}
        title={spec?.title}
        description={spec?.description}
        confirmLabel={spec?.label}
        variant={spec?.variant}
        reasonLabel="Note (optional, stored with the report)"
        busy={action.busy}
        error={action.error}
        onConfirm={(note) => run(pending, note)}
        onCancel={() => setPending(null)}
      />
      <AdminComposeDialog open={Boolean(compose)} recipient={compose} reportId={reportId} onClose={() => setCompose(null)} />
    </AdminPage>
  );
}
