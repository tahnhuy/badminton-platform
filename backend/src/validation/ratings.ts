import { z } from 'zod';

export const ratingMatchIdParamSchema = z.object({
  matchId: z.coerce.number().int().positive(),
});

export const ratingUserIdParamSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

const ratingItemSchema = z.object({
  ratedPlayerId: z.number().int().positive(),
  skillRating: z.number().int().min(1).max(5),
  attitudeRating: z.number().int().min(1).max(5),
  comment: z
    .string()
    .trim()
    .max(500, 'Nhận xét tối đa 500 ký tự')
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
});

export const createRatingsBodySchema = z
  .object({
    ratings: z
      .array(ratingItemSchema)
      .min(1, 'Cần ít nhất một đánh giá')
      .max(3, 'Tối đa 3 đánh giá mỗi lần gửi'),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<number>();
    value.ratings.forEach((item, index) => {
      if (seen.has(item.ratedPlayerId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['ratings', index, 'ratedPlayerId'],
          message: 'Mỗi người chỉ được đánh giá một lần trong một lần gửi',
        });
      }
      seen.add(item.ratedPlayerId);
    });
  });

export const listRatingsQuerySchema = z.object({
  direction: z.enum(['given', 'received']).default('given'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const skillAdjustmentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateRatingsBody = z.infer<typeof createRatingsBodySchema>;
export type ListRatingsQuery = z.infer<typeof listRatingsQuerySchema>;
export type SkillAdjustmentListQuery = z.infer<typeof skillAdjustmentListQuerySchema>;
