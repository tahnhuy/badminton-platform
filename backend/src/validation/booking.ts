import { z } from 'zod';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const timeStringSchema = z
  .string()
  .regex(TIME_REGEX, 'Invalid time format (expected HH:mm)');

function isRealCalendarDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const dateStringSchema = z
  .string()
  .refine(isRealCalendarDate, 'Invalid date (expected a real YYYY-MM-DD calendar date)');

export const courtIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const courtSearchQuerySchema = z
  .object({
    city: z.string().trim().min(1).optional(),
    district: z.string().trim().min(1).optional(),
    date: dateStringSchema.optional(),
    startTime: timeStringSchema.optional(),
    endTime: timeStringSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .superRefine((value, ctx) => {
    const hasStart = value.startTime !== undefined;
    const hasEnd = value.endTime !== undefined;

    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startTime and endTime must be provided together',
        path: ['startTime'],
      });
    }
    if ((hasStart || hasEnd) && !value.date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'date is required when a time window is provided',
        path: ['date'],
      });
    }
    if (
      value.startTime &&
      value.endTime &&
      value.startTime.slice(0, 5) >= value.endTime.slice(0, 5)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endTime must be after startTime',
        path: ['endTime'],
      });
    }
  });

export const courtAvailabilityQuerySchema = z.object({
  date: dateStringSchema,
  durationMinutes: z.coerce.number().int().min(1).max(1440).optional(),
});

export const bookingIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createBookingBodySchema = z.object({
  courtId: z.coerce.number().int().positive(),
  bookingDate: dateStringSchema,
  startTime: timeStringSchema,
  durationMinutes: z.coerce.number().int().min(1).max(1440),
});

export const myBookingsQuerySchema = z.object({
  status: z
    .enum(['PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED'])
    .optional(),
  timeScope: z.enum(['UPCOMING', 'PAST', 'ALL']).default('ALL'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type CourtSearchQuery = z.infer<typeof courtSearchQuerySchema>;
export type CourtAvailabilityQuery = z.infer<typeof courtAvailabilityQuerySchema>;
export type CreateBookingBody = z.infer<typeof createBookingBodySchema>;
export type MyBookingsQuery = z.infer<typeof myBookingsQuerySchema>;
