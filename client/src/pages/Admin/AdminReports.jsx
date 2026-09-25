import { useState } from "react";

import AdminChip from "../../components/admin/AdminChip";
import AdminPage from "../../components/admin/AdminPage";
import AdminPagination from "../../components/admin/AdminPagination";
import AdminReportCard from "../../components/admin/AdminReportCard";
import { SkeletonLines } from "../../components/admin/AdminLoadingSkeleton";
import Card from "../../components/ui/Card";
import { useAdminReports } from "../../hooks/admin/useAdminReports";

const STATUSES = [
  ["pending", "Pending"],
  ["reviewing", "Reviewing"],
  ["resolved", "Resolved"],
  ["dismissed", "Dismissed"],
];
const TYPES = [
  ["", "All types"],
  ["user", "Users"],
  ["post", "Posts"],
  ["comment", "Comments"],
  ["reply", "Replies"],
];

/** /admin/reports — the moderation inbox, one status at a time, paginated by the server. */
export default function AdminReports() {
  const [status, setStatus] = useState("pending");
  const [targetType, setTargetType] = useState("");
  const [page, setPage] = useState(1);
  const reports = useAdminReports({ status, targetType, page });
  const counts = reports.data?.counts;

  return (
    <AdminPage title="Reports" subtitle="What people have flagged for review.">
      <div className="flex flex-col gap-3">
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0" role="tablist" aria-label="Report status">
          <div className="flex w-max gap-1.5">
            {STATUSES.map(([key, label]) => (
              <AdminChip
                key={key}
                role="tab"
                active={status === key}
                onClick={() => {
                  setStatus(key);
                  setPage(1);
                }}
              >
                {label}
                {counts ? ` (${counts[key]})` : ""}
              </AdminChip>
            ))}
          </div>
        </div>
        <select
          value={targetType}
          onChange={(event) => {
            setTargetType(event.target.value);
            setPage(1);
          }}
          aria-label="Report type"
          className="h-11 w-full max-w-xs rounded-lg border border-line bg-panel px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {reports.loading ? (
        <SkeletonLines rows={5} />
      ) : reports.error ? (
        <Card className="text-sm text-danger" role="alert">
          {reports.error}
        </Card>
      ) : !reports.data.items.length ? (
        <Card className="py-10 text-center text-sm text-muted" data-testid="admin-empty">
          No {status} reports.
        </Card>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {reports.data.items.map((report) => (
            <li key={report.id}>
              <AdminReportCard report={report} />
            </li>
          ))}
        </ul>
      )}
      {reports.data && <AdminPagination page={reports.data.page} totalPages={reports.data.totalPages} total={reports.data.total} onPage={setPage} noun="reports" disabled={reports.loading} />}
    </AdminPage>
  );
}
