import { useMemo } from "react";

import useAdminQuery from "./useAdminQuery";

export function useAdminReports({ status, targetType, page }) {
  const params = useMemo(() => ({ status, targetType, page }), [status, targetType, page]);
  return useAdminQuery("/admin/reports", params);
}

export function useAdminReport(reportId) {
  return useAdminQuery(`/admin/reports/${reportId}`);
}
