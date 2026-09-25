import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { startTracking, stopTracking, trackPage } from "../../utility/pageEngagement";

/**
 * Page analytics: tells the server which page was opened (the path only — no query
 * string, no content) and how long it was actively used. All of the logic lives in
 * utility/pageEngagement so it is independent of React's render cycle; this component
 * only forwards route changes. Failures are ignored; analytics never gets in the way.
 */
export default function PageTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    startTracking();
    return stopTracking;
  }, []);

  useEffect(() => {
    trackPage(pathname);
  }, [pathname]);

  return null;
}
