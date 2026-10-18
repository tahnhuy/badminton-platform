import { useCallback, useEffect, useRef, useState } from 'react';
import { bookingService } from '../services/bookingService';
import { ApiError } from '../../../shared/api/http-client';
import type { BookingDetail } from '../types/booking';

export type BookingDetailStatus = 'loading' | 'success' | 'error';

const LIVE_STATUSES = ['PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'];

export function useBookingDetail(bookingId: number | null, pollMs = 8000) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [status, setStatus] = useState<BookingDetailStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const requestIdRef = useRef(0);
  const hasDataRef = useRef(false);
  const liveRef = useRef(true);

  const load = useCallback(async () => {
    if (bookingId === null || !Number.isFinite(bookingId)) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    try {
      const data = await bookingService.getBookingDetail(bookingId);
      if (requestIdRef.current !== requestId) return;
      setBooking(data);
      setStatus('success');
      setError(null);
      setIsStale(false);
      hasDataRef.current = true;
      liveRef.current = LIVE_STATUSES.includes(data.status);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      const message = err instanceof ApiError ? err.message : 'Không thể tải đơn đặt sân.';
      setError(message);
      if (hasDataRef.current) {
        // Keep the last good snapshot; a transient poll failure is not a status change.
        setIsStale(true);
        setStatus('success');
      } else {
        setStatus('error');
      }
    }
  }, [bookingId]);

  useEffect(() => {
    if (bookingId === null) return;
    hasDataRef.current = false;
    liveRef.current = true;
    setStatus('loading');
    setBooking(null);
    setError(null);
    setIsStale(false);
    void load();
    const timer = window.setInterval(() => {
      if (liveRef.current) void load();
    }, pollMs);
    return () => window.clearInterval(timer);
  }, [bookingId, pollMs, load]);

  return { booking, status, error, isStale, refresh: load };
}
