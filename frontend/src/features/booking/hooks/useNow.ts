import { useEffect, useState } from 'react';

/**
 * Returns the current time, re-rendering on a fixed interval so a displayed
 * timestamp ticks without waiting for a data reload.
 */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}
