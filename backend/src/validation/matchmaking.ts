import { z } from 'zod';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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

export const matchmakingTimeStringSchema = z
  .string()
  .regex(TIME_REGEX, 'Giờ không hợp lệ, phải theo định dạng HH:mm (00:00–23:59)');

export const matchmakingDateStringSchema = z
  .string()
  .refine(isRealCalendarDate, 'Ngày không hợp lệ, phải theo định dạng YYYY-MM-DD');

export const matchmakingRequestIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const matchmakingInvitationIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const matchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createMatchmakingRequestBodySchema = z.object({
  matchType: z.enum(['SINGLES', 'DOUBLES'], { message: 'Loại trận không hợp lệ (chỉ nhận SINGLES hoặc DOUBLES)' }),
  preferredDate: matchmakingDateStringSchema,
  preferredStartTime: matchmakingTimeStringSchema,
  preferredEndTime: matchmakingTimeStringSchema,
  minSkillLevelId: z.coerce.number({ message: 'Trình độ tối thiểu không hợp lệ' }).int().positive(),
  maxSkillLevelId: z.coerce.number({ message: 'Trình độ tối đa không hợp lệ' }).int().positive(),
  area: z
    .string({ message: 'Vui lòng nhập khu vực' })
    .trim()
    .min(1, 'Vui lòng nhập khu vực (tỉnh/quận)')
    .max(200, 'Khu vực quá dài (tối đa 200 ký tự)'),
});

export const listRequestsQuerySchema = z.object({
  status: z.enum(['OPEN', 'MATCHED', 'CANCELLED', 'EXPIRED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const candidatesQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  includeOutOfRange: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => value === true || value === 'true')
    .default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const sendInvitationBodySchema = z.object({
  inviteeId: z.coerce.number().int().positive(),
});

export const listInvitationsQuerySchema = z.object({
  direction: z.enum(['RECEIVED', 'SENT']).default('RECEIVED'),
  status: z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED', 'WITHDRAWN']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const respondInvitationBodySchema = z.object({
  decision: z.enum(['ACCEPTED', 'DECLINED']),
});

export const listMatchesQuerySchema = z.object({
  status: z.enum(['PENDING_COURT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  timeScope: z.enum(['UPCOMING', 'PAST', 'ALL']).default('ALL'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type CreateMatchmakingRequestBody = z.infer<typeof createMatchmakingRequestBodySchema>;
export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>;
export type CandidatesQuery = z.infer<typeof candidatesQuerySchema>;
export type SendInvitationBody = z.infer<typeof sendInvitationBodySchema>;
export type ListInvitationsQuery = z.infer<typeof listInvitationsQuerySchema>;
export type RespondInvitationBody = z.infer<typeof respondInvitationBodySchema>;
export type ListMatchesQuery = z.infer<typeof listMatchesQuerySchema>;
