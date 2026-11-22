import type { FreeInterval } from '../types/booking';

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatTime(value: string): string {
  return value.slice(0, 5);
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

export function minutesToLabel(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/** Adds minutes to an `HH:mm` time, wrapping at midnight, and returns `HH:mm`. */
export function addMinutesToTime(value: string, minutes: number): string {
  return minutesToLabel(timeToMinutes(value) + minutes);
}

/** Free interval that fully covers `[startTime, startTime + durationMinutes)`. */
export function findCoveringInterval(
  intervals: FreeInterval[],
  startTime: string,
  durationMinutes: number,
): FreeInterval | null {
  const start = timeToMinutes(startTime);
  const end = start + durationMinutes;
  return (
    intervals.find(interval => {
      const intervalStart = timeToMinutes(interval.startTime);
      const intervalEnd = timeToMinutes(interval.endTime);
      return intervalStart <= start && intervalEnd >= end;
    }) ?? null
  );
}

/**
 * Estimated price of a window carved out of a free interval, derived from its
 * priced segments. Returns null when the window is not fully covered.
 */
export function priceForWindow(
  interval: FreeInterval,
  startTime: string,
  durationMinutes: number,
): number | null {
  const start = timeToMinutes(startTime);
  const end = start + durationMinutes;
  if (timeToMinutes(interval.startTime) > start || timeToMinutes(interval.endTime) < end) {
    return null;
  }
  let total = 0;
  let covered = 0;
  for (const segment of interval.segments) {
    const segmentStart = timeToMinutes(segment.startTime);
    const segmentEnd = timeToMinutes(segment.endTime);
    const overlapStart = Math.max(segmentStart, start);
    const overlapEnd = Math.min(segmentEnd, end);
    if (overlapEnd <= overlapStart) continue;
    total += segment.price * ((overlapEnd - overlapStart) / 60);
    covered += overlapEnd - overlapStart;
  }
  return covered < durationMinutes ? null : round2(total);
}

export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function addDaysIso(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function formatDisplayDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatDuration(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} giờ` : `${hours.toFixed(1)} giờ`;
}

export function bookingStartInstant(date: string, startTime: string): Date {
  const normalized = startTime.length === 5 ? `${startTime}:00` : startTime;
  return new Date(`${date}T${normalized}+07:00`);
}

export function isCancellable(status: string, bookingDate: string, startTime: string): boolean {
  if (status !== 'PENDING_PAYMENT' && status !== 'CONFIRMED') return false;
  return bookingStartInstant(bookingDate, startTime).getTime() > Date.now();
}
