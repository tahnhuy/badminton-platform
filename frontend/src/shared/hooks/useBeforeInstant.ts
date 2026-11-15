import { useEffect, useState } from 'react';

/** A single deadline timer updates time-dependent actions without polling the server. */
export function useBeforeInstant(iso: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  const deadline = iso ? new Date(iso).getTime() : 0;
  useEffect(() => {
    if (!deadline) return;
    // Clamp the browser's signed 32-bit timer; distant deadlines are rescheduled.
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const remaining = deadline - Date.now();
      timer = setTimeout(() => { setNow(Date.now()); if (deadline > Date.now()) schedule(); }, Math.min(Math.max(remaining, 0) + 1, 2_147_483_647));
    };
    schedule(); return () => clearTimeout(timer);
  }, [deadline]);
  return deadline > now;
}
