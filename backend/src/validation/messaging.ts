import { z } from 'zod';

const positiveIntParam = z.coerce.number().int().positive();

export const conversationIdParamSchema = z.object({
  id: positiveIntParam,
});

export const messageIdParamSchema = z.object({
  id: positiveIntParam,
});

export const mediaIdParamSchema = z.object({
  id: positiveIntParam,
});

export const blockPlayerParamSchema = z.object({
  playerId: positiveIntParam,
});

export const playerSearchQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  limit: z.coerce.number().int().min(1).max(20).optional().default(20),
});

export const conversationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const createDirectConversationBodySchema = z.object({
  playerId: z.number().int().positive(),
});

export const createGroupConversationBodySchema = z.object({
  title: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length >= 1 && v.length <= 120, {
      message: 'Group title must be between 1 and 120 characters',
    }),
  memberIds: z.array(z.number().int().positive()).min(1),
});

export const addGroupMembersBodySchema = z.object({
  memberIds: z.array(z.number().int().positive()).min(1),
});

export const blockPlayerBodySchema = z.object({
  playerId: z.number().int().positive(),
});

export const markReadBodySchema = z.object({
  seq: z.number().int().min(0),
});

export const messageReactionBodySchema = z.object({
  type: z.enum(['LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY']),
});

export const messagesHistoryQuerySchema = z.object({
  beforeSeq: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(30),
});

export const messagesSyncQuerySchema = z.object({
  afterSeq: z.coerce.number().int().min(0).optional().default(0),
  sinceVersion: z.coerce.number().int().min(0).optional().default(0),
  minLoadedSeq: z.coerce.number().int().min(0).optional().default(1),
});

