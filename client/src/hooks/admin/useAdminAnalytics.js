import { useMemo } from "react";

import useAdminQuery from "./useAdminQuery";

// Range: "today" | "week" | "month" — aggregated on the server.
export default function useAdminAnalytics(range) {
  const params = useMemo(() => ({ range }), [range]);
  return useAdminQuery("/admin/analytics", params);
}

// One page's Today / This Week / This Month numbers; loads only once a page is chosen.
export function useAdminPageAnalytics(page) {
  return useAdminQuery(`/admin/analytics/pages/${encodeURIComponent(page || "-")}`, undefined, { enabled: Boolean(page) });
}
