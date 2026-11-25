import { z } from 'zod';

// Request-boundary schemas for Social (Social Tech Design §9). Content rules that have
// feature error codes (trim, empty, length, image count) are applied in the service so the
// approved codes are returned.

const postBackground = z.enum(['forest', 'ocean', 'sunset', 'berry', 'midnight', 'confetti']).nullable().optional();

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const id = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const boolQuery = z.enum(['true', 'false']).transform(value => value === 'true');

/**
 * YYYY-MM-DD that is a real calendar date (Gregorian leap years), checked arithmetically:
 * no Date parsing, so an out-of-range day is rejected instead of rolling into another date.
 */
export function isCalendarDate(value: string): boolean {
  const match = DATE_REGEX.exec(value);
  if (!match) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth;
}

export const REACTION_TYPES = ['LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export const postIdParamSchema = z.object({ id });
export const commentIdParamSchema = z.object({ id });

/** `payload` JSON of POST /posts (multipart) or the JSON body. */
export const createPostPayloadSchema = z.object({
  type: z.enum(['FREE', 'MATCH_FINDING']),
  body: z.string().max(20_000).nullable().optional(),
  background: postBackground,
  title: z.string().max(2_000).nullable().optional(),
  clientRequestId: z.string().uuid(),
  publish: z.boolean().optional(),
  recruitment: z.unknown().optional(),
}).strict();
export type CreatePostPayload = z.infer<typeof createPostPayloadSchema>;

/** `payload` JSON of PATCH /posts/:id. Omitted fields keep their value. */
export const editPostPayloadSchema = z.object({
  body: z.string().max(20_000).nullable().optional(),
  background: postBackground,
  title: z.string().max(2_000).nullable().optional(),
  keepImageIds: z.array(id).max(4).optional(),
}).strict();
export type EditPostPayload = z.infer<typeof editPostPayloadSchema>;

export const feedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  asOf: z.string().datetime({ offset: true }).optional(),
  type: z.enum(['FREE', 'MATCH_FINDING', 'TOURNAMENT_RESULT']).optional(),
  matchType: z.enum(['SINGLES', 'DOUBLES', 'GROUP']).optional(),
  date: z.string().refine(isCalendarDate, 'Ngày không hợp lệ, phải là ngày có thật theo định dạng YYYY-MM-DD').optional(),
  timeFrom: z.string().regex(TIME_REGEX).optional(),
  timeTo: z.string().regex(TIME_REGEX).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  district: z.string().trim().min(1).max(100).optional(),
  skillLevelId: id.optional(),
  hasOpenSlots: boolQuery.optional(),
  includeEnded: boolQuery.optional(),
  sort: z.enum(['newest', 'upcoming']).optional(),
}).strict();
export type FeedQuery = z.infer<typeof feedQuerySchema>;

export const commentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();
export type CommentsQuery = z.infer<typeof commentsQuerySchema>;

export const reactionBodySchema = z.object({ type: z.string() }).strict();

export const createCommentBodySchema = z.object({
  body: z.string().max(5_000),
  clientRequestId: z.string().uuid(),
}).strict();
export type CreateCommentBody = z.infer<typeof createCommentBodySchema>;

export const deletePostQuerySchema = z.object({
  bookingAction: z.enum(['KEEP', 'CANCEL']).optional(),
}).strict();

/** Parses the multipart `payload` field (or a JSON body) with the given schema. */
export function parsePayload<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const raw = (body as Record<string, unknown> | undefined) ?? {};
  if (typeof raw.payload === 'string') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.payload);
    } catch {
      parsed = undefined;
    }
    return schema.parse(parsed);
  }
  return schema.parse(raw);
}
