import { Link } from "react-router-dom";

import Avatar from "../ui/Avatar";
import Card from "../ui/Card";
import { formatTime } from "../../utility/helpers";
import { REASON_LABEL } from "./reportLabels";
import { Pill } from "./AdminUserStatus";


const TYPE_LABEL = { user: "User", post: "Post", comment: "Comment", reply: "Reply" };

/** One report in the inbox: what, why, who reported whom, when, and its state. */
export default function AdminReportCard({ report }) {
  return (
    <Link to={`/admin/reports/${report.id}`} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" data-testid="admin-report">
      <Card interactive className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-1.5">
            <Pill tone="reviewing">{TYPE_LABEL[report.targetType]}</Pill>
            <span className="text-sm font-semibold text-ink">{REASON_LABEL[report.reason]}</span>
          </span>
          <Pill tone={report.status}>{report.status}</Pill>
        </div>
        {report.snapshot?.text && <p className="line-clamp-2 text-sm wrap-break-word text-muted">“{report.snapshot.text}”</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar person={report.reporter || {}} size="xs" />
            <span className="truncate">Reported by {report.reporter?.fullName || "unknown"}</span>
          </span>
          <span className="truncate">About {report.reportedUser?.fullName || "unknown"}</span>
          <span>{formatTime(report.createdAt)}</span>
        </div>
      </Card>
    </Link>
  );
}
