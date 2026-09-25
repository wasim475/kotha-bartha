import { ArrowBack } from "@mui/icons-material";
import { useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";

import AdminActionMenu from "../../components/admin/AdminActionMenu";
import AdminButton from "../../components/admin/AdminButton";
import AdminComposeDialog from "../../components/admin/AdminComposeDialog";
import AdminPage from "../../components/admin/AdminPage";
import AdminStatCard from "../../components/admin/AdminStatCard";
import AdminUserStatus from "../../components/admin/AdminUserStatus";
import { useAdmin } from "../../components/admin/AdminContext";
import useUserActions from "../../components/admin/useUserActions";
import { SkeletonLines } from "../../components/admin/AdminLoadingSkeleton";
import Avatar from "../../components/ui/Avatar";
import Card from "../../components/ui/Card";
import { useAdminUser } from "../../hooks/admin/useAdminUsers";
import { formatTime } from "../../utility/helpers";
import { cx } from "../../utility/cx";
import { ActivityTab, ContentTab, ReportsTab } from "./userTabs";

const TABS = [
  ["overview", "Overview"],
  ["posts", "Posts"],
  ["comments", "Comments"],
  ["replies", "Replies"],
  ["activity", "Quiz & Games"],
  ["reports", "Reports"],
];

const when = (value) => (value ? formatTime(value) : "—");

function Overview({ user }) {
  const rows = [
    ["Email", user.email],
    ["Current city", user.currentCity || "—"],
    ["Hometown", user.hometown || "—"],
    ["Joined", when(user.createdAt)],
    ["Last active", when(user.lastSeenAt)],
  ];
  const m = user.moderation;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminStatCard label="Posts" value={user.counts.posts} />
        <AdminStatCard label="Comments" value={user.counts.comments} />
        <AdminStatCard label="Replies" value={user.counts.replies} />
        <AdminStatCard label="Reports about" value={user.counts.reportsAgainst} tone={user.counts.reportsAgainst ? "text-accent" : undefined} />
      </div>
      <Card>
        <dl className="grid gap-2 text-sm min-[560px]:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[11px] font-bold tracking-wide text-muted uppercase">{label}</dt>
              <dd className="wrap-break-word text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        {user.bio && <p className="mt-3 border-t border-line pt-3 text-sm wrap-break-word text-muted">{user.bio}</p>}
      </Card>
      {(m.banned || m.muted) && (
        <Card className="border-danger/40 text-sm" data-testid="admin-moderation-state">
          {m.banned && (
            <p>
              <strong>Banned</strong> {when(m.bannedAt)}. {m.banReason ? `Reason: ${m.banReason}` : "No reason recorded."}
            </p>
          )}
          {m.muted && (
            <p>
              <strong>Muted</strong> {when(m.mutedAt)}. {m.muteReason ? `Reason: ${m.muteReason}` : "No reason recorded."}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

/** /admin/users/:userId — profile and moderation; each tab loads only when opened. */
export default function AdminUserDetails() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: me } = useOutletContext();
  const { role } = useAdmin();
  const [tab, setTab] = useState("overview");
  const [composeFor, setComposeFor] = useState(null);
  const detail = useAdminUser(userId);
  const actions = useUserActions({
    me,
    isAdmin: role === "admin",
    onChanged: (kind) => (kind === "delete" ? navigate("/admin/users") : detail.reload()),
    onMessage: setComposeFor,
  });
  const user = detail.data;

  return (
    <AdminPage
      title="User"
      actions={
        <AdminButton variant="outline" onClick={() => navigate("/admin/users")}>
          <ArrowBack fontSize="small" /> All users
        </AdminButton>
      }
    >
      {detail.loading && <SkeletonLines rows={4} />}
      {detail.error && (
        <Card className="text-sm text-danger" role="alert">
          {detail.error}
        </Card>
      )}
      {user && (
        <>
          <Card className="flex min-w-0 flex-wrap items-center gap-3" data-testid="admin-user-header">
            <Avatar person={user} size="lg" />
            <div className="min-w-0 flex-1 basis-48">
              <h2 className="truncate font-display text-xl font-semibold text-ink">{user.fullName}</h2>
              <p className="truncate text-sm text-muted">{user.email}</p>
              <div className="mt-1.5">
                <AdminUserStatus user={user} />
              </div>
            </div>
            <AdminActionMenu label="User actions" items={actions.itemsFor(user, { includeView: false })} />
          </Card>

          <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0" role="tablist" aria-label="User sections">
            <div className="flex w-max gap-1.5">
              {TABS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={cx("min-h-10 rounded-full border px-3.5 text-xs font-semibold whitespace-nowrap transition-colors", tab === key ? "border-accent bg-accent/12 text-accent" : "border-line bg-panel text-muted hover:text-ink")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {tab === "overview" && <Overview user={user} />}
          {tab === "posts" && <ContentTab userId={userId} tab="posts" active />}
          {tab === "comments" && <ContentTab userId={userId} tab="comments" type="comment" active />}
          {tab === "replies" && <ContentTab userId={userId} tab="comments" type="reply" active />}
          {tab === "activity" && <ActivityTab userId={userId} active />}
          {tab === "reports" && <ReportsTab userId={userId} active />}
        </>
      )}

      {actions.dialog}
      <AdminComposeDialog open={Boolean(composeFor)} recipient={composeFor} onClose={() => setComposeFor(null)} />
    </AdminPage>
  );
}
