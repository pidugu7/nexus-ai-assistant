import { useEffect, useState } from "react";
import { formatClock } from "../lib/formatClock.js";

export function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return formatClock(now);
}
