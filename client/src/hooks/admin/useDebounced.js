import { useEffect, useState } from "react";

// The value, but only after it has stopped changing for `delay` ms (search boxes).
export default function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
