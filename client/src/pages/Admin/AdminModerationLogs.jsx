import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import AdminDataTable from "../../components/admin/AdminDataTable";
import AdminPage from "../../components/admin/AdminPage";
import AdminPagination from "../../components/admin/AdminPagination";
import { Pill } from "../../components/admin/AdminUserStatus";
import useAdminQuery from "../../hooks/admin/useAdminQuery";
import { formatTime } from "../../utility/helpers";

const ACTIONS = [
  ["", "All actions"],
  ["user.", "User actions"],
  ["post.", "Post deletions"],
  ["comment.", "Comment deletions"],
  ["reply.", "Reply deletions"],
  ["report.", "Reports"],
  ["quiz.", "Quiz content"],
  ["game.", "Game content"],
  ["admin.", "Admin messages"],
];

// A short, safe summary of an entry's metadata (never message text or credentials).
function summary(entry) {
  const m = entry.metadata || {};
  const parts = [];
  if (m.from && m.to) parts.push(`${m.from} → ${m.to}`);
  if (m.reason) parts.push(`reason: ${m.reason}`);
  if (m.resolutionAction) parts.push(m.resolutionAction.replace("_", " "));
  if (m.via) parts.push(`via ${m.via.replace("_", " ")}`);
  if (m.preview) parts.push(`“${m.preview}”`);
  if (m.name) parts.push(m.name);
  if (m.hidden) parts.push(`hid ${m.hidden.posts} posts, ${m.hidden.comments} comments`);
  if (m.restored) parts.push(`restored ${m.restored.posts} posts, ${m.restored.comments} comments`);
  if (m.path) parts.push(m.path);
  return parts.join(" · ") || "—";
}

/** /admin/moderation-logs — the append-only record of every admin action. */
export default function AdminModerationLogs() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const params = useMemo(() => ({ page, action }), [page, action]);
  const logs = useAdminQuery("/admin/moderation-logs", params);

  const columns = [
    { key: "when", header: "When", render: (entry) => <span className="whitespace-nowrap text-muted">{formatTime(entry.createdAt)}</span> },
    { key: "admin", header: "Admin", render: (entry) => <span className="whitespace-nowrap font-semibold">{entry.admin?.fullName || "—"}</span> },
    { key: "action", header: "Action", render: (entry) => <Pill tone="reviewing">{entry.action}</Pill> },
    { key: "target", header: "Target", render: (entry) => (entry.targetUser ? <Link to={`/admin/users/${entry.targetUser.id}`} className="font-semibold hover:underline">{entry.targetUser.fullName}</Link> : <span className="text-muted">{entry.targetType || "—"}</span>) },
    { key: "details", header: "Details", render: (entry) => <span className="block max-w-md text-xs wrap-break-word text-muted">{summary(entry)}</span> },
  ];

  return (
    <AdminPage title="Moderation Logs" subtitle="Every important admin action, newest first. Entries can't be edited or removed.">
      <select
        value={action}
        onChange={(event) => {
          setAction(event.target.value);
          setPage(1);
        }}
        aria-label="Action type"
        className="h-11 w-full max-w-xs rounded-lg border border-line bg-panel px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {ACTIONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <AdminDataTable columns={columns} rows={logs.data?.items} loading={logs.loading} error={logs.error} empty="No entries yet." />
      {logs.data && <AdminPagination page={logs.data.page} totalPages={logs.data.totalPages} total={logs.data.total} onPage={setPage} noun="entries" disabled={logs.loading} />}
    </AdminPage>
  );
}
