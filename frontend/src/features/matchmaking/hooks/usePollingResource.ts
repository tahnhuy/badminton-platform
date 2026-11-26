import { useCallback, useEffect, useState } from 'react';

/** One request at a time; discard results after navigation and pause hidden tabs. */
export function usePollingResource<T>(load: () => Promise<T>, enabled = true, refreshToken?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(v => v + 1), []);
  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    let active = true;
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setData(null);
    setError(null);
    setLoading(true);
    const run = async () => {
      if (!active || busy || document.visibilityState === 'hidden') return;
      clearTimeout(timer);
      busy = true;
      try {
        const result = await load();
        if (active) { setData(result); setError(null); }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason : new Error('Không thể tải dữ liệu.'));
      } finally {
        busy = false;
        if (active) { setLoading(false); timer = setTimeout(() => { void run(); }, 5000); }
      }
    };
    const resume = () => { if (document.visibilityState !== 'hidden') void run(); else clearTimeout(timer); };
    void run();
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  // A caller revision restarts the same request lifecycle without changing API parameters.
  }, [load, enabled, version, refreshToken]);
  return { data, error, loading, refresh };
}
