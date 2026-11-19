export type TimeRangePreset = 'day' | 'month' | 'year' | 'custom';

export interface TimeRangeValue {
  preset: TimeRangePreset;
  startDate?: string;
  endDate?: string;
}

export const TIME_RANGE_OPTIONS: Array<{ value: TimeRangePreset; label: string }> = [
  { value: 'day', label: 'Ngày này' },
  { value: 'month', label: 'Tháng này' },
  { value: 'year', label: 'Năm này' },
  { value: 'custom', label: 'Khoảng thời gian' },
];

export function isIsoDate(value: string | undefined): value is string {
  if (!value) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Current calendar date (YYYY-MM-DD) in the given IANA timezone. */
export function todayIsoDate(timeZone = 'Asia/Ho_Chi_Minh'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function addDaysToIsoDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isValidTimeRange(value: TimeRangeValue): boolean {
  if (value.preset !== 'custom') return true;
  return isIsoDate(value.startDate) && isIsoDate(value.endDate) && value.endDate > value.startDate;
}
