import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { Close } from "@mui/icons-material";
import { useMemo, useState } from "react";
import { Outlet } from "react-router-dom";

import useAdminQuery from "../../hooks/admin/useAdminQuery";
import IconButton from "../ui/IconButton";
import { AdminContext } from "./AdminContext";
import AdminHeader from "./AdminHeader";
import AdminSidebar from "./AdminSidebar";
import { SkeletonLines } from "./AdminLoadingSkeleton";
import AccessDenied from "./AccessDenied";

/**
 * The Admin Panel frame: a sticky sidebar on desktop, a slide-in drawer on phones,
 * a header, and the page. Which sections appear comes from the SERVER (GET
 * /admin/me); if the server refuses, the panel shows "access denied" and nothing else.
 */
export default function AdminShell({ user }) {
  const [drawer, setDrawer] = useState(false);
  const me = useAdminQuery("/admin/me");
  const unread = useAdminQuery("/admin/messages/unread-count", undefined, { enabled: Boolean(me.data?.sections.includes("messages")) });

  const value = useMemo(
    () => ({ role: me.data?.role || null, sections: me.data?.sections || [], counts: { reports: unread.data?.reports || 0, support: unread.data?.support || 0 } }),
    [me.data, unread.data],
  );

  if (me.loading) {
    return (
      <div className="min-h-dvh bg-paper p-6">
        <SkeletonLines rows={5} className="mx-auto max-w-3xl" />
      </div>
    );
  }
  if (me.error || !me.data) return <AccessDenied />;

  return (
    <AdminContext.Provider value={value}>
      <div className="min-h-dvh bg-paper text-ink lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="sticky top-0 z-20 hidden h-dvh overflow-y-auto border-r border-line bg-panel p-3 lg:block" aria-label="Sidebar">
          <p className="px-3 pt-2 pb-3 text-[11px] font-bold tracking-wide text-muted uppercase">Kotha-Barta</p>
          <AdminSidebar />
        </aside>

        <div className="min-w-0">
          <AdminHeader user={user} onOpenMenu={() => setDrawer(true)} />
          <main className="mx-auto w-full max-w-6xl min-w-0 px-3 py-5 sm:px-6 sm:py-7">
            <Outlet context={{ user }} />
          </main>
        </div>

        <Dialog open={drawer} onClose={setDrawer} className="relative z-50 lg:hidden">
          <DialogBackdrop transition className="fixed inset-0 bg-black/45 transition-opacity duration-150 data-[closed]:opacity-0" />
          <DialogPanel transition className="fixed inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-panel p-3 shadow-soft transition duration-200 data-[closed]:-translate-x-full" data-testid="admin-drawer">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="font-display text-base font-semibold text-ink">Admin Panel</span>
              <IconButton label="Close menu" icon={<Close />} onClick={() => setDrawer(false)} />
            </div>
            <AdminSidebar onNavigate={() => setDrawer(false)} />
          </DialogPanel>
        </Dialog>
      </div>
    </AdminContext.Provider>
  );
}
