import { cn } from '@/shared/utils/cn';

const formatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 2,
});

/** A read-only preview: never changes the raw amount submitted by the form. */
export function MoneyPreview({ value, suffix, className }: { value: string | number | null | undefined; suffix?: string; className?: string }) {
  const raw = String(value ?? '').trim();
  const amount = Number(raw);
  const valid = /^\d+(\.\d{1,2})?$/.test(raw) && Number.isFinite(amount) && amount <= Number.MAX_SAFE_INTEGER;
  return <p aria-live="polite" aria-atomic="true" className={cn('text-sm font-medium text-primary tabular-nums wrap-anywhere', className)}>
    {valid ? `Xem trước: ${formatter.format(amount)}${suffix ?? ''}` : null}
  </p>;
}
