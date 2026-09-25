import { Create } from "@mui/icons-material";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AdminChip from "../../components/admin/AdminChip";
import AdminButton from "../../components/admin/AdminButton";
import AdminComposeDialog from "../../components/admin/AdminComposeDialog";
import AdminPage from "../../components/admin/AdminPage";
import AdminPagination from "../../components/admin/AdminPagination";
import { Pill } from "../../components/admin/AdminUserStatus";
import { SkeletonLines } from "../../components/admin/AdminLoadingSkeleton";
import Avatar from "../../components/ui/Avatar";
import Card from "../../components/ui/Card";
import { useAdminMessage, useAdminMessages } from "../../hooks/admin/useAdminMessages";
import { formatTime } from "../../utility/helpers";
import { cx } from "../../utility/cx";

const TABS = [
  ["all", "All"],
  ["unread", "Unread"],
  ["reports", "Reports"],
  ["user", "User Messages"],
  ["system", "System"],
];
const KIND_LABEL = { user: "Message", report: "Report", system: "Sent by admin" };

function Detail({ selected, onReply, onClose }) {
  const detail = useAdminMessage(selected.kind, selected.id);
  const item = detail.data;
  return (
    <Card className="flex min-w-0 flex-col gap-3" data-testid="admin-message-detail">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-ink">{selected.subject}</h2>
        <button type="button" onClick={onClose} className="text-xs font-semibold text-accent lg:hidden">
          Back to list
        </button>
      </div>
      {detail.loading && <SkeletonLines rows={3} />}
      {detail.error && <p role="alert" className="text-sm text-danger">{detail.error}</p>}
      {item && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <Avatar person={item.from || {}} size="xs" />
            <span className="font-semibold text-ink">{item.from?.fullName}</span>
            {item.to && <span>→ {item.to.fullName}</span>}
            <span>{formatTime(item.createdAt)}</span>
          </div>
          <p className="rounded-lg bg-soft p-3 text-sm whitespace-pre-wrap wrap-break-word text-ink">{item.body}</p>
          {item.target && (
            <p className="text-xs text-muted">
              About a {item.target.type}:{" "}
              {item.target.type === "user" ? (
                <Link to={`/admin/users/${item.target.id}`} className="font-semibold text-accent">
                  open profile
                </Link>
              ) : (
                <Link to={`/admin/posts/${item.target.id}`} className="font-semibold text-accent">
                  open
                </Link>
              )}
            </p>
          )}
          {item.report && (
            <p className="text-xs text-muted">
              Linked to a report:{" "}
              <Link to={`/admin/reports/${item.report.id}`} className="font-semibold text-accent">
                {item.report.targetType} · {item.report.reason}
              </Link>
            </p>
          )}
          {item.kind === "user" && item.from?.id && (
            <div>
              <AdminButton onClick={() => onReply(item.from)}>Reply</AdminButton>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

/** /admin/messages — what users sent in, the reports filed, and what admins have sent. */
export default function AdminMessages() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [compose, setCompose] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const inbox = useAdminMessages({ tab, page });

  const open = (row) => {
    if (row.kind === "report") return navigate(`/admin/reports/${row.id}`);
    setSelected(row);
  };

  return (
    <AdminPage
      title="Messages"
      subtitle="Complaints and questions from users, reports, and messages you have sent."
      actions={
        <AdminButton onClick={() => { setReplyTo(null); setCompose(true); }}>
          <Create fontSize="small" /> New message
        </AdminButton>
      }
    >
      <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0" role="tablist" aria-label="Inbox tabs">
        <div className="flex w-max gap-1.5">
          {TABS.map(([key, label]) => (
            <AdminChip
              key={key}
              role="tab"
              active={tab === key}
              onClick={() => {
                setTab(key);
                setPage(1);
                setSelected(null);
              }}
            >
              {label}
            </AdminChip>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className={cx("flex min-w-0 flex-col gap-3", selected && "hidden lg:flex")}>
          {inbox.loading ? (
            <SkeletonLines rows={5} />
          ) : inbox.error ? (
            <Card className="text-sm text-danger" role="alert">{inbox.error}</Card>
          ) : !inbox.data.items.length ? (
            <Card className="py-10 text-center text-sm text-muted" data-testid="admin-empty">Nothing here.</Card>
          ) : (
            <ul className="flex flex-col gap-2">
              {inbox.data.items.map((row) => (
                <li key={`${row.kind}-${row.id}`}>
                  <button type="button" onClick={() => open(row)} className="block w-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" data-testid="admin-message-row" data-read={row.read ? "true" : "false"}>
                    <Card interactive className={cx("flex min-w-0 items-start gap-3 p-3", selected?.id === row.id && "ring-2 ring-accent")}>
                      <Avatar person={row.from || {}} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center justify-between gap-x-2">
                          <span className={cx("truncate text-sm text-ink", row.read ? "font-medium" : "font-bold")}>{row.from?.fullName}</span>
                          <span className="text-[11px] text-muted">{formatTime(row.createdAt)}</span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          {!row.read && <span className="size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                          <Pill tone={row.kind === "report" ? "pending" : row.kind === "system" ? "dismissed" : "reviewing"}>{KIND_LABEL[row.kind]}</Pill>
                          <span className="truncate text-xs font-semibold text-ink">{row.subject}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">{row.preview}</span>
                      </span>
                    </Card>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {inbox.data && <AdminPagination page={inbox.data.page} totalPages={inbox.data.totalPages} total={inbox.data.total} onPage={setPage} noun="items" disabled={inbox.loading} />}
        </div>

        <div className={cx("min-w-0", !selected && "hidden lg:block")}>
          {selected ? (
            <Detail
              key={`${selected.kind}-${selected.id}`}
              selected={selected}
              onClose={() => setSelected(null)}
              onReply={(user) => {
                setReplyTo(user);
                setCompose(true);
              }}
            />
          ) : (
            <Card className="hidden py-16 text-center text-sm text-muted lg:block">Select a message to read it.</Card>
          )}
        </div>
      </div>

      <AdminComposeDialog open={compose} recipient={replyTo} onClose={() => setCompose(false)} onSent={inbox.reload} />
    </AdminPage>
  );
}
