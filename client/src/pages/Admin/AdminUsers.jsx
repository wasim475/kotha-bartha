import { Search } from "@mui/icons-material";
import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";

import AdminActionMenu from "../../components/admin/AdminActionMenu";
import AdminComposeDialog from "../../components/admin/AdminComposeDialog";
import AdminDataTable from "../../components/admin/AdminDataTable";
import AdminPage from "../../components/admin/AdminPage";
import AdminPagination from "../../components/admin/AdminPagination";
import AdminUserStatus from "../../components/admin/AdminUserStatus";
import { useAdmin } from "../../components/admin/AdminContext";
import useUserActions from "../../components/admin/useUserActions";
import Avatar from "../../components/ui/Avatar";
import useDebounced from "../../hooks/admin/useDebounced";
import { useAdminUsers } from "../../hooks/admin/useAdminUsers";
import { formatTime } from "../../utility/helpers";
import { cx } from "../../utility/cx";

const FILTERS = [
  ["all", "All"],
  ["admin", "Admin"],
  ["moderator", "Moderator"],
  ["user", "User"],
  ["banned", "Banned"],
  ["muted", "Muted"],
];

const when = (value) => (value ? formatTime(value) : "—");

/** /admin/users — exactly 50 per page, searched and filtered by the server. */
export default function AdminUsers() {
  const { user: me } = useOutletContext();
  const { role } = useAdmin();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [composeFor, setComposeFor] = useState(null);
  const q = useDebounced(search.trim(), 350);
  const users = useAdminUsers({ page, q, filter });
  const actions = useUserActions({ me, isAdmin: role === "admin", onChanged: users.reload, onMessage: setComposeFor });

  const rows = users.data?.users;
  const name = (user) => (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar person={user} size="sm" />
      <Link to={`/admin/users/${user.id}`} className="min-w-0 truncate font-semibold text-ink hover:underline">
        {user.fullName}
      </Link>
    </span>
  );

  const columns = [
    { key: "name", header: "Name", render: name },
    { key: "email", header: "Email", render: (user) => <span className="block max-w-56 truncate text-muted" title={user.email}>{user.email}</span> },
    { key: "city", header: "City", render: (user) => user.currentCity || "—" },
    { key: "status", header: "Role / Status", render: (user) => <AdminUserStatus user={user} /> },
    { key: "joined", header: "Joined", render: (user) => <span className="whitespace-nowrap text-muted">{when(user.createdAt)}</span> },
    { key: "seen", header: "Last active", render: (user) => <span className="whitespace-nowrap text-muted">{when(user.lastSeenAt)}</span> },
    { key: "actions", header: "", className: "w-12 text-right", render: (user) => <AdminActionMenu label={`Actions for ${user.fullName}`} items={actions.itemsFor(user)} /> },
  ];

  const renderCard = (user) => (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        {name(user)}
        <AdminActionMenu label={`Actions for ${user.fullName}`} items={actions.itemsFor(user)} />
      </div>
      <p className="truncate text-xs text-muted" title={user.email}>
        {user.email}
      </p>
      <AdminUserStatus user={user} />
      <p className="text-xs text-muted">
        {user.currentCity ? `${user.currentCity} · ` : ""}Joined {when(user.createdAt)} · Active {when(user.lastSeenAt)}
      </p>
    </div>
  );

  return (
    <AdminPage title="Users" subtitle="Everyone with an account, fifty per page.">
      <div className="flex flex-col gap-3">
        <label className="relative block">
          <span className="sr-only">Search users by name or email</span>
          <Search fontSize="small" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email…"
            className="h-11 w-full rounded-lg border border-line bg-panel pr-3 pl-10 text-sm text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
            data-testid="admin-user-search"
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter users">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => {
                setFilter(key);
                setPage(1);
              }}
              className={cx("min-h-10 rounded-full border px-3.5 text-xs font-semibold transition-colors", filter === key ? "border-accent bg-accent/12 text-accent" : "border-line bg-panel text-muted hover:text-ink")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <AdminDataTable columns={columns} rows={rows} loading={users.loading} error={users.error} empty="No users match." renderCard={renderCard} />
      {users.data && <AdminPagination page={users.data.page} totalPages={users.data.totalPages} total={users.data.totalUsers} onPage={setPage} noun="users" disabled={users.loading} />}

      {actions.dialog}
      <AdminComposeDialog open={Boolean(composeFor)} recipient={composeFor} onClose={() => setComposeFor(null)} />
    </AdminPage>
  );
}
