const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns true only for a real calendar date in YYYY-MM-DD form.
 *
 * A plain regex accepts values such as 2026-02-31 or 2026-13-45, which later
 * become `Invalid Date` (or silently roll over) when parsed for SQL filters.
 */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
