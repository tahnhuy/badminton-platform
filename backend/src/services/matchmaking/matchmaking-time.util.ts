export const MATCHMAKING_TIMEZONE = 'Asia/Ho_Chi_Minh';

const TIME_PATTERN = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;

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

export function dateTimeToInstant(date: string, time: string): Date {
  const normalized = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${normalized}+07:00`);
}

export function todayInAppTimezone(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MATCHMAKING_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * 60 * 1000);
}

export function minInstant(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

export function windowLengthMinutes(startTime: string, endTime: string): number {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
}

export function normalizeTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}
