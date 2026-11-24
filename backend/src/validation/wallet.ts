import { z } from 'zod';

export const createTopUpBodySchema = z.object({
  amount: z.union([z.string(), z.number()]).transform(value => String(value)),
  provider: z.enum(['MOCK', 'SEPAY', 'VNPAY']).optional(),
  idempotencyKey: z.string().trim().min(1).max(120).optional(),
});

export const topUpIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const bankAccountBodySchema = z.object({
  bankCode: z.string().trim().min(1).max(50),
  accountNumber: z.string().trim().min(4).max(50),
  accountName: z.string().trim().min(1).max(120),
  isDefault: z.boolean().optional(),
});

export const payoutRequestBodySchema = z.object({
  amount: z.union([z.string(), z.number()]).transform(value => String(value)),
  bankAccountId: z.coerce.number().int().positive(),
  withdrawalPin: z.string().regex(/^\d{6}$/, 'Withdrawal PIN must be 6 digits'),
  clientRequestId: z.string().trim().uuid('clientRequestId must be a UUID'),
});

export const withdrawalPinResetBodySchema = z.object({
  resetToken: z.string().trim().min(1).max(512),
  newPin: z.string().regex(/^\d{6}$/, 'Withdrawal PIN must be 6 digits'),
  confirmPin: z.string(),
}).strict().refine(data => data.newPin === data.confirmPin, {
  message: 'Withdrawal PIN confirmation does not match',
  path: ['confirmPin'],
});

export const payoutIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const adminPayoutListQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'PAID', 'FAILED']).optional(),
});

export const adminPayoutActionBodySchema = z.object({
  note: z.string().trim().max(200).optional(),
  transferReference: z.string().trim().max(120).optional(),
});

export const adminWalletAdjustBodySchema = z.object({
  amount: z.union([z.string(), z.number()]).transform(value => String(value)),
  reason: z.string().trim().min(1).max(200),
});

export const adminWalletUserParamSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

export const adminRefundListQuerySchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'REFUNDED', 'FAILED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const walletEntriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
