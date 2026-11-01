import { useEffect, useRef } from 'react';

/** Refresh when returning to a visible page; no Social polling interval. */
export function useVisibilityRefresh(refresh: () => void) {
  const callback = useRef(refresh);
  useEffect(() => { callback.current = refresh; }, [refresh]);
  useEffect(() => {
    const visible = () => { if (document.visibilityState === 'visible') callback.current(); };
    document.addEventListener('visibilitychange', visible);
    return () => document.removeEventListener('visibilitychange', visible);
  }, []);
}
