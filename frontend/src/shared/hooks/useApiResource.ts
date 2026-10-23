import { useCallback, useEffect, useState } from 'react';
import { httpClient } from '../api/http-client';
export function useApiResource<T>(path: string | null, polling = false) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string | null; data?: T; error?: string }>({ key: null });
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController(); let active = true; let pending = false;
    const read = async () => {
      if (pending) return; pending = true;
      try { const data = await httpClient<T>(path, { signal: controller.signal }); if (active) setResult({ key: path, data }); }
      catch { if (active) setResult(previous => ({ key: path, data: previous.key === path ? previous.data : undefined, error: 'Không thể tải dữ liệu. Vui lòng thử lại.' })); }
      finally { pending = false; }
    };
    void read();
    const timer = polling ? window.setInterval(() => { if (!document.hidden) void read(); }, 7500) : undefined;
    return () => { active = false; controller.abort(); window.clearInterval(timer); };
  }, [path, polling, revision]);
  return { data: result.key === path ? result.data : undefined, error: result.key === path ? result.error : undefined, loading: !!path && (result.key !== path || (!result.data && !result.error)), reload };
}
