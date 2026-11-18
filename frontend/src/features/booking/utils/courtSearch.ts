import { z } from 'zod';
import type { CourtFacilitySummary, CourtSearchParams, CourtSummary } from '../types/booking';

/** Courts per page. The API pages by court (max 50); 24 keeps most facilities on one page. */
export const COURT_PAGE_SIZE = 24;

/** Search state kept in the URL so back, reload and shared links restore the same results. */
export interface CourtSearchState {
  city: string;
  district: string;
  date: string;
  from: string;
  to: string;
  page: number;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const text = (value: string | null) => (value ?? '').trim().slice(0, 100);

/** Reads and sanitizes URL params; invalid or past values fall back to defaults instead of erroring. */
export function readCourtSearch(params: URLSearchParams, today: string): CourtSearchState {
  const date = params.get('date') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const page = Number(params.get('page'));
  const validWindow = TIME.test(from) && TIME.test(to) && from < to;
  return {
    city: text(params.get('city')),
    district: text(params.get('district')),
    date: DATE.test(date) && date >= today ? date : today,
    from: validWindow ? from : '',
    to: validWindow ? to : '',
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
  };
}

/** Writes the state onto a copy of `base`, keeping unrelated params such as `matchId`. Defaults are omitted. */
export function writeCourtSearch(state: CourtSearchState, base: URLSearchParams, today: string): URLSearchParams {
  const next = new URLSearchParams(base);
  const set = (key: string, value: string) => (value ? next.set(key, value) : next.delete(key));
  set('city', state.city.trim());
  set('district', state.district.trim());
  set('date', state.date && state.date !== today ? state.date : '');
  set('from', state.from);
  set('to', state.to);
  set('page', state.page > 1 ? String(state.page) : '');
  return next;
}

export function toCourtSearchParams(state: CourtSearchState): CourtSearchParams {
  const hasWindow = Boolean(state.from && state.to);
  return {
    city: state.city || undefined,
    district: state.district || undefined,
    date: state.date,
    startTime: hasWindow ? state.from : undefined,
    endTime: hasWindow ? state.to : undefined,
    page: state.page,
    limit: COURT_PAGE_SIZE,
  };
}

/** Filter form: area is optional; a time window needs both ends, and the end must follow the start. */
export function courtFilterSchema(today: string) {
  return z.object({
    city: z.string().trim().max(100, 'Tối đa 100 ký tự.'),
    district: z.string().trim().max(100, 'Tối đa 100 ký tự.'),
    date: z.string().regex(DATE, 'Vui lòng chọn ngày chơi.').refine(value => value >= today, 'Không thể chọn ngày đã qua.'),
    from: z.string(),
    to: z.string(),
  }).superRefine((values, ctx) => {
    if (values.from && !values.to) ctx.addIssue({ code: 'custom', path: ['to'], message: 'Chọn cả giờ kết thúc.' });
    if (values.to && !values.from) ctx.addIssue({ code: 'custom', path: ['from'], message: 'Chọn cả giờ bắt đầu.' });
    if (values.from && values.to && values.from >= values.to) ctx.addIssue({ code: 'custom', path: ['to'], message: 'Giờ kết thúc phải sau giờ bắt đầu.' });
  });
}
export type CourtFilterValues = z.infer<ReturnType<typeof courtFilterSchema>>;

export interface FacilityGroup {
  facility: CourtFacilitySummary;
  courts: CourtSummary[];
  priceFrom: number | null;
}

/** Groups a page of courts by facility, keeping the server's price order of first appearance. */
export function groupCourtsByFacility(courts: CourtSummary[]): FacilityGroup[] {
  const groups = new Map<number, FacilityGroup>();
  for (const court of courts) {
    const group = groups.get(court.facility.id) ?? { facility: court.facility, courts: [], priceFrom: null };
    group.courts.push(court);
    if (court.priceFrom != null) group.priceFrom = group.priceFrom == null ? court.priceFrom : Math.min(group.priceFrom, court.priceFrom);
    groups.set(court.facility.id, group);
  }
  return [...groups.values()];
}
