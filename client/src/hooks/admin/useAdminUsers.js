import { useMemo } from "react";

import useAdminQuery from "./useAdminQuery";

// Fifty per page, searched and filtered on the server. `query` is { page, q, filter }.
export function useAdminUsers({ page, q, filter }) {
  const params = useMemo(() => ({ page, q, filter: filter === "all" ? "" : filter }), [page, q, filter]);
  return useAdminQuery("/admin/users", params);
}

export function useAdminUser(userId) {
  return useAdminQuery(`/admin/users/${userId}`);
}

// One tab of the user detail page; loads only while `enabled` (the tab is open).
export function useAdminUserTab(userId, tab, { page = 1, extra = {}, enabled }) {
  const params = useMemo(() => ({ page, ...extra }), [page, extra]);
  return useAdminQuery(`/admin/users/${userId}/${tab}`, params, { enabled });
}
