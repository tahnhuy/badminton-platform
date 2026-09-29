const TIME_PATTERN = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;

export const APP_TIMEZONE = 'Asia/Ho_Chi_Minh';

export interface PricingInterval {
  id?: number;
  startTime: string;
  endTime: string;
  price: number;
}

export interface WindowPricingSegment {
  courtPricingId: number | null;
  startTime: string;
  endTime: string;
  price: number;
  amount: number;
}

export interface WindowPricing {
  totalAmount: number;
  durationMinutes: number;
  segments: WindowPricingSegment[];
}

export interface OccupiedInterval {
  startTime: string;
  endTime: string;
}

export interface FreeSegment {
  startTime: string;
  endTime: string;
  price: number;
}

export interface FreeInterval {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  segments: FreeSegment[];
  estimatedPrice: number | null;
}

interface MinuteSegment {
  start: number;
  end: number;
  price: number;
}

interface MinuteInterval {
  start: number;
  end: number;
  segments: MinuteSegment[];
}

export function timeToMinutes(value: string): number {
  const match = TIME_PATTERN.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid time value: ${value}`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToTime(total: number): string {
  const normalized = ((total % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function todayInAppTimezone(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function nowMinutesInAppTimezone(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

/**
 * Earliest minute of the day that may still be booked for the given date,
 * interpreted in the fixed application timezone. Past dates return end-of-day
 * so every derived interval is dropped; future dates are unrestricted.
 */
export function notBeforeMinutesForDate(date: string, now: Date = new Date()): number {
  const today = todayInAppTimezone(now);
  if (date < today) return 24 * 60;
  if (date > today) return 0;
  return nowMinutesInAppTimezone(now);
}

export function dateTimeToInstant(date: string, time: string): Date {
  const normalized = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${normalized}+07:00`);
}

export function addDaysToDateString(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function buildPricedSegments(
  pricings: PricingInterval[],
  opening: number,
  closing: number
): MinuteSegment[] {
  return pricings
    .map((pricing) => ({
      start: Math.max(timeToMinutes(pricing.startTime), opening),
      end: Math.min(timeToMinutes(pricing.endTime), closing),
      price: pricing.price,
    }))
    .filter((segment) => segment.start < segment.end)
    .sort((a, b) => a.start - b.start);
}

function subtractOccupied(segments: MinuteSegment[], occupied: OccupiedInterval[]): MinuteSegment[] {
  let free = segments.map((segment) => ({ ...segment }));

  for (const slot of occupied) {
    const occupiedStart = timeToMinutes(slot.startTime);
    const occupiedEnd = timeToMinutes(slot.endTime);
    const next: MinuteSegment[] = [];

    for (const segment of free) {
      if (occupiedEnd <= segment.start || occupiedStart >= segment.end) {
        next.push(segment);
        continue;
      }
      if (occupiedStart > segment.start) {
        next.push({ ...segment, end: occupiedStart });
      }
      if (occupiedEnd < segment.end) {
        next.push({ ...segment, start: occupiedEnd });
      }
    }
    free = next;
  }

  return free.sort((a, b) => a.start - b.start);
}

function mergeFreeSegments(segments: MinuteSegment[]): MinuteInterval[] {
  const intervals: MinuteInterval[] = [];
  let current: MinuteInterval | null = null;

  for (const segment of segments) {
    if (current && current.end === segment.start) {
      current.end = segment.end;
      current.segments.push(segment);
      continue;
    }
    if (current) {
      intervals.push(current);
    }
    current = { start: segment.start, end: segment.end, segments: [segment] };
  }

  if (current) {
    intervals.push(current);
  }
  return intervals;
}

function priceForDuration(
  segments: MinuteSegment[],
  start: number,
  durationMinutes: number,
  intervalEnd: number
): number | null {
  if (durationMinutes <= 0 || start + durationMinutes > intervalEnd) {
    return null;
  }

  const targetEnd = start + durationMinutes;
  let total = 0;
  for (const segment of segments) {
    const overlap = Math.min(segment.end, targetEnd) - Math.max(segment.start, start);
    if (overlap > 0) {
      total += segment.price * (overlap / 60);
    }
  }
  return Math.round(total * 100) / 100;
}

export function computeFreeIntervals(params: {
  openingTime: string;
  closingTime: string;
  pricings: PricingInterval[];
  occupied: OccupiedInterval[];
  durationMinutes?: number | null;
  notBeforeMinutes?: number | null;
}): FreeInterval[] {
  const opening = timeToMinutes(params.openingTime);
  const closing = timeToMinutes(params.closingTime);
  if (opening >= closing) {
    return [];
  }

  const priced = buildPricedSegments(params.pricings, opening, closing);
  const available = subtractOccupied(priced, params.occupied);
  const notBefore = Math.max(0, params.notBeforeMinutes ?? 0);

  return mergeFreeSegments(available)
    .map((interval): FreeInterval | null => {
      const start = Math.max(interval.start, notBefore);
      if (start >= interval.end) {
        return null;
      }
      const segments = interval.segments
        .filter((segment) => segment.end > start)
        .map((segment) => ({
          start: Math.max(segment.start, start),
          end: segment.end,
          price: segment.price,
        }));
      return {
        startTime: minutesToTime(start),
        endTime: minutesToTime(interval.end),
        durationMinutes: interval.end - start,
        segments: segments.map((segment) => ({
          startTime: minutesToTime(segment.start),
          endTime: minutesToTime(segment.end),
          price: segment.price,
        })),
        estimatedPrice:
          params.durationMinutes != null
            ? priceForDuration(segments, start, params.durationMinutes, interval.end)
            : null,
      };
    })
    .filter((interval): interval is FreeInterval => interval !== null);
}

export function intervalCovers(intervals: FreeInterval[], start: string, end: string): boolean {
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  return intervals.some((interval) => {
    const intervalStart = timeToMinutes(interval.startTime);
    const intervalEnd = timeToMinutes(interval.endTime);
    return intervalStart <= startMin && intervalEnd >= endMin;
  });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Prices an arbitrary window from contiguous pricing intervals.
 * Returns null when the window is invalid or not fully covered by priced time.
 */
export function computeWindowPricing(
  pricings: PricingInterval[],
  start: string,
  end: string
): WindowPricing | null {
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  if (endMin <= startMin) {
    return null;
  }

  const segments = pricings
    .map((pricing) => ({
      id: pricing.id ?? null,
      start: timeToMinutes(pricing.startTime),
      end: timeToMinutes(pricing.endTime),
      price: pricing.price,
    }))
    .filter((segment) => segment.start < segment.end)
    .sort((a, b) => a.start - b.start);

  const details: WindowPricingSegment[] = [];
  let cursor = startMin;

  for (const segment of segments) {
    if (cursor >= endMin) break;
    if (segment.end <= cursor || segment.start >= endMin) continue;
    if (segment.start > cursor) {
      return null;
    }
    const overlapEnd = Math.min(segment.end, endMin);
    const overlapMinutes = overlapEnd - cursor;
    details.push({
      courtPricingId: segment.id,
      startTime: minutesToTime(cursor),
      endTime: minutesToTime(overlapEnd),
      price: segment.price,
      amount: round2(segment.price * (overlapMinutes / 60)),
    });
    cursor = overlapEnd;
  }

  if (cursor < endMin || details.length === 0) {
    return null;
  }

  return {
    totalAmount: round2(details.reduce((sum, detail) => sum + detail.amount, 0)),
    durationMinutes: endMin - startMin,
    segments: details,
  };
}
