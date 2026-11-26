/**
 * Demo time is relative to the moment the seed runs, in Vietnam time (UTC+7, no DST):
 * "3 days ago at 18:00" always means 18:00 in Ho Chi Minh City. Columns are
 * `timestamp without time zone` holding UTC, so instants are built in UTC.
 */
const VN_OFFSET_MS = 7 * 3_600_000;
const DAY_MS = 86_400_000;

export interface Clock {
  readonly now: Date;
  /** Instant of a Vietnam wall-clock time `hh:mm` on the day `dayOffset` days from today. */
  at(dayOffset: number, hhmm?: string): Date;
  /** Vietnam calendar date (`YYYY-MM-DD`) `dayOffset` days from today. */
  date(dayOffset: number): string;
  /** `minutes` minutes before/after now (negative = past). */
  minutesFromNow(minutes: number): Date;
}

export function createClock(now: Date = new Date()): Clock {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  const todayStartUtc = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - VN_OFFSET_MS;

  return {
    now,
    at(dayOffset, hhmm = '09:00') {
      const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
      if (!match) throw new Error(`Invalid clock time: ${hhmm}`);
      return new Date(todayStartUtc + dayOffset * DAY_MS + (Number(match[1]) * 60 + Number(match[2])) * 60_000);
    },
    date(dayOffset) {
      return new Date(todayStartUtc + dayOffset * DAY_MS + VN_OFFSET_MS).toISOString().slice(0, 10);
    },
    minutesFromNow(minutes) {
      return new Date(now.getTime() + minutes * 60_000);
    },
  };
}
