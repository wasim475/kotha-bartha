import { useMemo } from "react";

import useAdminQuery from "./useAdminQuery";

// The admin inbox. Tabs: all | unread | reports | user | system.
export function useAdminMessages({ tab, page }) {
  const params = useMemo(() => ({ tab, page }), [tab, page]);
  return useAdminQuery("/admin/messages", params);
}

export function useAdminMessage(kind, id) {
  return useAdminQuery(`/admin/messages/${kind}/${id}`, undefined, { enabled: Boolean(kind && id) });
}

export function useAdminUnread() {
  return useAdminQuery("/admin/messages/unread-count");
}
