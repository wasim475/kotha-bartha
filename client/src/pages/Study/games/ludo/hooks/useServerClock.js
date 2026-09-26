import { useEffect, useState } from "react";

// A ticking "now" for screens that show time relative to a server deadline. The
// caller adds the server clock offset, so a wrong device clock never matters.
export default function useServerClock(active = true, everyMs = 200) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [active, everyMs]);
  return now;
}
