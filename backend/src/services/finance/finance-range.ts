import { AppError } from '../../errors/AppError';

export const FINANCE_RANGES = ['today', '7d', '30d', 'this_month', 'custom'] as const;
export type FinanceRange = (typeof FINANCE_RANGES)[number];

const BUSINESS_TIMEZONE = 'Asia/Ho_Chi_Minh';
const DAY_MS = 86_400_000;
const MAX_CUSTOM_DAYS = 366;

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface FinanceBounds {
  range: FinanceRange;
  start: Date;
  end: Date;
  startDate: string;
  endDate: string;
  days: number;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function zonedParts(date: Date): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function zonedTimeToUtc(year: number, month: number, day: number): Date {
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const parts = zonedParts(new Date(guess));
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return new Date(guess - (asUtc - guess));
}

export function formatFinanceDate(date: Date): string {
  const parts = zonedParts(date);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function isoParts(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function addDaysIsoDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function resolveFinanceRange(
  query: { range?: FinanceRange; startDate?: string; endDate?: string },
  now: Date = new Date(),
): FinanceBounds {
  const range = query.range ?? '30d';
  const parts = zonedParts(now);
  const todayStart = zonedTimeToUtc(parts.year, parts.month, parts.day);
  const today = formatFinanceDate(todayStart);

  if (range === 'today') {
    return { range, start: todayStart, end: new Date(todayStart.getTime() + DAY_MS), startDate: today, endDate: today, days: 1 };
  }
  if (range === '7d' || range === '30d') {
    const days = range === '7d' ? 7 : 30;
    return {
      range,
      start: new Date(todayStart.getTime() - (days - 1) * DAY_MS),
      end: new Date(todayStart.getTime() + DAY_MS),
      startDate: formatFinanceDate(new Date(todayStart.getTime() - (days - 1) * DAY_MS)),
      endDate: today,
      days,
    };
  }
  if (range === 'this_month') {
    const monthStart = zonedTimeToUtc(parts.year, parts.month, 1);
    const nextMonth = parts.month === 12
      ? zonedTimeToUtc(parts.year + 1, 1, 1)
      : zonedTimeToUtc(parts.year, parts.month + 1, 1);
    return {
      range,
      start: monthStart,
      end: nextMonth,
      startDate: formatFinanceDate(monthStart),
      endDate: formatFinanceDate(new Date(nextMonth.getTime() - 1)),
      days: Math.round((nextMonth.getTime() - monthStart.getTime()) / DAY_MS),
    };
  }

  if (!query.startDate || !query.endDate || query.endDate < query.startDate) {
    throw new AppError(
      'FINANCE_INVALID_RANGE',
      400,
      'A custom range requires startDate and endDate, and endDate must be on or after startDate',
    );
  }

  const start = zonedTimeToUtc(isoParts(query.startDate).year, isoParts(query.startDate).month, isoParts(query.startDate).day);
  const nextDay = addDaysIsoDate(query.endDate, 1);
  const end = zonedTimeToUtc(isoParts(nextDay).year, isoParts(nextDay).month, isoParts(nextDay).day);
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  if (days > MAX_CUSTOM_DAYS) {
    throw new AppError('FINANCE_INVALID_RANGE', 400, `Custom range cannot exceed ${MAX_CUSTOM_DAYS} days`);
  }

  return { range, start, end, startDate: query.startDate, endDate: query.endDate, days };
}
