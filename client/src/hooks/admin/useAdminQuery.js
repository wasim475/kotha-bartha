import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "../../utility/api";

const errorText = (error) => error.response?.data?.error?.message || "Something went wrong. Please try again.";

// Drops empty values so `?q=&filter=all` never reaches the server needlessly.
const clean = (params) => Object.fromEntries(Object.entries(params || {}).filter(([, value]) => value !== "" && value !== null && value !== undefined));

/**
 * One server request for the Admin Panel: loads `url` with `params`, cancels the
 * previous request when they change (a fast typist never sees stale results), and
 * reports { data, meta, loading, error, reload }. `loading` is true from the moment
 * the inputs change until THEIR response arrives, so a screen never shows the
 * previous query's numbers (or a misleading zero) while the new ones load.
 * `enabled: false` defers the request (tabs load only when opened).
 */
export default function useAdminQuery(url, params, { enabled = true } = {}) {
  const [state, setState] = useState({ key: null, data: null, meta: null, error: "" });
  const [nonce, setNonce] = useState(0);
  const query = useMemo(() => new URLSearchParams(clean(params)).toString(), [params]);
  const key = `${url}?${query}#${nonce}`;

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    api
      .get(url, { params: Object.fromEntries(new URLSearchParams(query)), signal: controller.signal })
      .then(({ data }) => setState({ key, data: data.data, meta: data.meta || null, error: "" }))
      .catch((error) => {
        if (controller.signal.aborted || error.code === "ERR_CANCELED") return;
        setState({ key, data: null, meta: null, error: errorText(error) });
      });
    return () => controller.abort();
  }, [url, query, key, enabled]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  const settled = state.key === key;

  return {
    data: settled ? state.data : null,
    meta: settled ? state.meta : null,
    error: settled ? state.error : "",
    loading: enabled && !settled,
    reload,
  };
}

export { errorText };
