import AdminPage from "../../components/admin/AdminPage";
import { Pill } from "../../components/admin/AdminUserStatus";
import { SkeletonLines } from "../../components/admin/AdminLoadingSkeleton";
import Card from "../../components/ui/Card";
import useAdminQuery from "../../hooks/admin/useAdminQuery";

const label = (action) => action.toLowerCase().split("_").join(" ");

/** /admin/settings — read-only: what a ban / mute blocks, and which role can use which section. */
export default function AdminSettings() {
  const settings = useAdminQuery("/admin/settings");
  const d = settings.data;
  return (
    <AdminPage title="Settings" subtitle="Moderation policy and role permissions (set in the server configuration).">
      {settings.loading && <SkeletonLines rows={4} />}
      {settings.error && <Card className="text-sm text-danger" role="alert">{settings.error}</Card>}
      {d && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-semibold text-ink">Banned accounts cannot</h2>
            <p className="text-xs text-muted">They can still sign in, browse, and contact the administrators.</p>
            <ul className="flex flex-wrap gap-1.5">
              {d.policy.banned.map((action) => (
                <li key={action}><Pill tone="banned">{label(action)}</Pill></li>
              ))}
            </ul>
          </Card>
          <Card className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-semibold text-ink">Muted accounts cannot</h2>
            <p className="text-xs text-muted">They can still browse and react.</p>
            <ul className="flex flex-wrap gap-1.5">
              {d.policy.muted.map((action) => (
                <li key={action}><Pill tone="muted">{label(action)}</Pill></li>
              ))}
            </ul>
          </Card>
          <Card className="flex flex-col gap-3 lg:col-span-2">
            <h2 className="font-display text-lg font-semibold text-ink">Role permissions</h2>
            {Object.entries(d.roleSections).map(([role, sections]) => (
              <div key={role} className="flex flex-wrap items-center gap-2">
                <Pill tone={role}>{role}</Pill>
                <span className="text-sm text-muted">{sections.join(", ")}</span>
              </div>
            ))}
          </Card>
        </div>
      )}
    </AdminPage>
  );
}
