import { z } from 'zod';

export const playerIdParamSchema = z.object({ id: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER) });
export const updatePlayerProfileSchema = z.object({ fullName: z.string().trim().min(2).max(50) }).strict();
