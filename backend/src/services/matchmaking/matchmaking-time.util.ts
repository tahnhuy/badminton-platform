export const MATCHMAKING_TIMEZONE = 'Asia/Ho_Chi_Minh';

/** New Social requests have a fixed interval and NULL legacy window columns. */
export function requestScheduleFields(request: {
  startAt: Date; durationMinutes: number;
  preferredDate: string | null; preferredStartTime: string | null; preferredEndTime: string | null;
}) {
  if (request.preferredDate && request.preferredStartTime && request.preferredEndTime) {
    return { preferredDate: request.preferredDate, preferredStartTime: request.preferredStartTime, preferredEndTime: request.preferredEndTime };
  }
  const local = (instant: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: MATCHMAKING_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(instant);
    const value = (type: string) => parts.find(part => part.type === type)!.value;
    return { date: `${value('year')}-${value('month')}-${value('day')}`, time: `${value('hour')}:${value('minute')}:${value('second')}` };
  };
  const start = local(request.startAt);
  const end = local(addMinutes(request.startAt, request.durationMinutes));
  return {
    preferredDate: request.preferredDate ?? start.date,
    preferredStartTime: request.preferredStartTime ?? start.time,
    preferredEndTime: request.preferredEndTime ?? end.time,
  };
}

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
