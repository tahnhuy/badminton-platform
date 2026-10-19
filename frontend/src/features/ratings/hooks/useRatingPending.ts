import { useCallback, useEffect, useState } from 'react';
import { ratingsService } from '../services/ratingsService';
import type { PendingResponse } from '../types/ratings';

/**
 * Loads the pending-rating view once per match/refresh. Used by host pages to
 * decide whether a rating entry point is available and to label it.
 */
export function useRatingPending(matchId: number, enabled: boolean) {
  const [data, setData] = useState<PendingResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setData(null);
    setError(null);
    ratingsService
      .getPending(matchId)
      .then((result) => {
        if (active) {
          setData(result);
          setError(null);
        }
      })
      .catch((reason) => {
        if (active) { setData(null); setError(reason instanceof Error ? reason : new Error('Không thể tải đánh giá.')); }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [matchId, enabled, version]);

  return { data: enabled && data?.matchId === matchId ? data : null, error: enabled ? error : null, loading, refresh };
}
