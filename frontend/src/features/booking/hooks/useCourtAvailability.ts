import { useCallback, useEffect, useRef, useState } from 'react';
import { bookingService } from '../services/bookingService';
import { ApiError } from '../../../shared/api/http-client';
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
  const [isStale, setIsStale] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const requestIdRef = useRef(0);
  const hasDataRef = useRef(false);

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
      setIsStale(false);
      setLastUpdatedAt(new Date());
      hasDataRef.current = true;
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      const message =
        err instanceof ApiError ? err.message : 'Không thể tải lịch trống. Vui lòng thử lại.';
      setError(message);
      if (hasDataRef.current) {
        // Keep showing the last good data; a transient poll failure must not be
        // mistaken for the slot becoming unavailable.
        setIsStale(true);
        setStatus('success');
      } else {
        setStatus('error');
      }
    }
  }, [courtId, date, durationMinutes]);

  useEffect(() => {
    if (courtId === null) return;
    hasDataRef.current = false;
    setStatus('loading');
    setAvailability(null);
    setError(null);
    setIsStale(false);
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [courtId, date, durationMinutes, load]);

  return { availability, status, error, isStale, lastUpdatedAt, refresh: load };
}
