import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { api } from "../../utility/api";

// One random id per browser tab session, kept only to tell visits apart. It holds no
// personal data and is never linked to a person by the browser: if the visitor is
// signed in, the SERVER attributes the view from the session cookie.
const sessionId = () => {
  try {
    let id = sessionStorage.getItem("kb-session");
    if (!id) {
      id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
      sessionStorage.setItem("kb-session", id);
    }
    return id;
  } catch {
    return `anon${Math.random().toString(36).slice(2, 14)}`;
  }
};

/**
 * Lightweight page-view tracking: on every route change it tells the server which
 * page was opened (the path only — no query string, no content). Failures are
 * ignored; analytics never gets in the user's way.
 */
export default function PageTracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    api.post("/analytics/pageview", { sessionId: sessionId(), path: pathname }).catch(() => {});
  }, [pathname]);
  return null;
}
