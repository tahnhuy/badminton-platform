import { useCallback, useEffect, useRef, useState } from 'react';
import { bookingService } from '../services/bookingService';
import { ApiError } from '../shared/api/http-client';
import type { CourtAvailability } from '../types/booking';

const POLL_INTERVAL_MS = 8000;

export type AvailabilityStatus = 'loading' | 'success' | 'error';

export function useCourtAvailability(
  courtId: number | null,
  date: string,
  durationMinutes: number
) {
  const [availability, setAvailability] = useState<CourtAvailability | null>(null);
  const [status, setStatus] = useState<AvailabilityStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (courtId === null || !date) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    try {
      const data = await bookingService.getCourtAvailability(courtId, date, durationMinutes);
      if (requestIdRef.current !== requestId) return;
      setAvailability(data);
      setStatus('success');
      setError(null);
      setLastUpdatedAt(new Date());
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      setStatus('error');
      setError(
        err instanceof ApiError ? err.message : 'Không thể tải lịch trống. Vui lòng thử lại.'
      );
    }
  }, [courtId, date, durationMinutes]);

  useEffect(() => {
    if (courtId === null) return;
    setStatus('loading');
    setAvailability(null);
    setError(null);
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [courtId, date, durationMinutes, load]);

  return { availability, status, error, lastUpdatedAt, refresh: load };
}
