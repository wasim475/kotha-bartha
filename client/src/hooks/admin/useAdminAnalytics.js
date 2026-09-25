import { useMemo } from "react";

import useAdminQuery from "./useAdminQuery";

// Range: "today" | "week" | "month" — aggregated on the server.
export default function useAdminAnalytics(range) {
  const params = useMemo(() => ({ range }), [range]);
  return useAdminQuery("/admin/analytics", params);
}
