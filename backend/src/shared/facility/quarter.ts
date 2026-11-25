/** Vietnam has no daylight saving time; the offset is fixed at UTC+7. */
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface QuarterBounds {
  /** Inclusive UTC instant of the quarter start, serialized as ISO. */
  start: string;
  /** Exclusive UTC instant of the next quarter start, serialized as ISO. */
  end: string;
}

/**
 * Returns the current calendar quarter boundaries in Asia/Ho_Chi_Minh as UTC
 * instants. Stored `created_at` values are timestamp-without-time-zone written
 * by a UTC session, so callers compare them with `AT TIME ZONE 'UTC'`.
 */
export function vietnamQuarterBounds(now: Date = new Date()): QuarterBounds {
  const vietnamWallClock = new Date(now.getTime() + VIETNAM_OFFSET_MS);
  const year = vietnamWallClock.getUTCFullYear();
  const startMonth = Math.floor(vietnamWallClock.getUTCMonth() / 3) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1) - VIETNAM_OFFSET_MS);
  const end = new Date(Date.UTC(year, startMonth + 3, 1) - VIETNAM_OFFSET_MS);
  return { start: start.toISOString(), end: end.toISOString() };
}
