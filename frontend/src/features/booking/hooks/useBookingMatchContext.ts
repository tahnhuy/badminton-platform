import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Navigation context only; never grants permission or changes a booking. */
export function useBookingMatchContext() {
  const [params] = useSearchParams();
  const parsed = Number(params.get('matchId'));
  const matchId = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  const forMatch = useCallback((path: string) => {
    if (!matchId) return path;
    const [pathname, query = ''] = path.split('?');
    const next = new URLSearchParams(query);
    next.set('matchId', String(matchId));
    return `${pathname}?${next}`;
  }, [matchId]);
  return { matchId, forMatch };
}
