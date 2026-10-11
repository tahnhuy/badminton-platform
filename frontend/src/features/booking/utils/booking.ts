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
