import { useCallback, useState } from "react";

import { api } from "../../utility/api";
import { errorText } from "./useAdminQuery";

/**
 * Runs Admin mutations and tracks their state. `run(method, url, body)` resolves
 * with the response data, or null after setting `error` — the caller decides what
 * to refresh. `busy` prevents a double click from sending an action twice.
 */
export default function useAdminAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(async (method, url, body) => {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.request({ method, url, data: body });
      return data.data ?? true;
    } catch (failure) {
      setError(errorText(failure));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const clearError = useCallback(() => setError(""), []);
  return { run, busy, error, clearError };
}
