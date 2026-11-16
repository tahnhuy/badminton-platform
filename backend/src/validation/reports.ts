import { z } from 'zod';

// RP-06 Player report creation (Report Management Tech Design §16). Only the three
// Social/Messaging targets are creatable; reason-code and evidence rules live in the
// service so the approved error codes are returned.
export const REPORT_CREATION_TARGET_TYPES = ['POST', 'COMMENT', 'MESSAGE'] as const;

export const createReportBodySchema = z.object({
  targetType: z.enum(REPORT_CREATION_TARGET_TYPES),
  targetId: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  attachmentId: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  reasonCode: z.string().min(1).max(64),
  description: z.string().max(2_000).optional(),
}).strict();
