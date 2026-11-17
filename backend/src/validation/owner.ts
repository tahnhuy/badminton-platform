import { z } from 'zod';
const name = z.string().trim().min(1).max(255);
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/).transform(v => v.slice(0, 5));
const date = z.iso.date();
// Numeric strings are also used by persisted review snapshots. Reject missing
// or non-numeric JSON values before coercion can turn them into coordinate 0.
const coordinate = (min: number, max: number) => z.union([z.number(), z.string().trim().min(1)])
  .pipe(z.coerce.number<string | number>().finite().min(min).max(max));
export const ownerIdParams = z.object({ id: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER) });
export const ownerPage = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_APPROVAL', 'REJECTED']).optional() });
export const ownerCourtBody = z.object({ name, description: z.string().trim().max(5000).optional() }).strict();
export const ownerLocationBody = z.object({ address: name, ward: name.nullable().optional(), district: name, city: name, latitude: coordinate(-90, 90), longitude: coordinate(-180, 180) }).strict();
const facilityFields = ownerLocationBody.extend({ name, description: z.string().trim().max(5000).optional(), phone: z.string().trim().min(1).max(40), openingTime: clock, closingTime: clock });
export const ownerFacilityBody = facilityFields.refine(v => v.openingTime < v.closingTime, { path: ['closingTime'], message: 'Closing time must be after opening time' });
export const ownerFacilityUpdate = facilityFields.partial().strict().refine(v => Object.keys(v).length > 0, 'At least one field is required');
export const ownerEmptyBody = z.object({}).strict();
export const ownerPricingQuery = z.object({ validOn: date.optional() });
export const ownerPricingBody = z.object({ pricingId: z.number().int().positive().optional(), startTime: clock, endTime: clock, pricePerHour: z.number().finite().positive(), validFrom: date, validTo: date.nullable().optional() }).strict()
  .refine(v => v.startTime < v.endTime, { path: ['endTime'], message: 'End time must be after start time' })
  .refine(v => !v.validTo || v.validFrom <= v.validTo, { path: ['validTo'], message: 'Invalid validity range' });

export const ownerScheduleQuery = z.object({ date: z.iso.date() });
export const ownerBlockBody = z.object({ bookingDate: z.iso.date(), startTime: clock, endTime: clock, reason: z.string().trim().min(1).max(2000) }).strict();
export const ownerUnblockBody = z.object({ blockId: z.number().int().positive() }).strict();
export const ownerCancelBookingBody = z.object({ reason: z.string().trim().min(1).max(2000) }).strict();
export const ownerHistoryQuery = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), status: z.enum(['PENDING_PAYMENT','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED','EXPIRED']).optional(), dateFrom: z.iso.date().optional(), dateTo: z.iso.date().optional() }).refine(v => !v.dateFrom || !v.dateTo || v.dateFrom <= v.dateTo, 'Invalid date range');
