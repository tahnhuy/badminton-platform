import { z } from 'zod';
import { FINANCE_RANGES } from '../services/finance/finance-range';
import { isIsoDate } from '../shared/validation/iso-date';

const isoDate = z.string().refine(isIsoDate, { message: 'Expected a valid YYYY-MM-DD date' });

export const financeRangeQuerySchema = z.object({
  range: z.enum(FINANCE_RANGES).default('30d'),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
});

export const financeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const decimalAmount = z
  .union([z.string(), z.number()])
  .transform(value => String(value).trim())
  .refine(value => /^\d+(\.\d{1,2})?$/.test(value), {
    message: 'Amount must be a non-negative number with up to 2 decimals',
  });

const positiveAmount = decimalAmount.refine(value => Number(value) > 0, {
  message: 'Amount must be greater than zero',
});

export const transactionQuerySchema = financeListQuerySchema.extend({
  source: z.enum(['ledger', 'top-up', 'payout', 'refund']).optional(),
  status: z.string().trim().max(40).optional(),
  userId: z.coerce.number().int().positive().optional(),
  referenceType: z.string().trim().max(40).optional(),
  referenceId: z.coerce.number().int().positive().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  minAmount: decimalAmount.optional(),
  maxAmount: decimalAmount.optional(),
});

export const transactionParamSchema = z.object({
  source: z.enum(['ledger', 'top-up', 'payout', 'refund']),
  id: z.coerce.number().int().positive(),
});

export const financeUserParamSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

export const walletEntriesQuerySchema = financeListQuerySchema;

export const walletHoldsQuerySchema = financeListQuerySchema.extend({
  status: z.enum(['HELD', 'CAPTURED', 'RELEASED']).optional(),
});

export const financeAdjustmentBodySchema = z.object({
  amount: positiveAmount,
  reason: z.string().trim().min(1).max(200),
});

export const topUpListQuerySchema = financeListQuerySchema.extend({
  status: z.enum(['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED']).optional(),
  provider: z.string().trim().max(30).optional(),
  userId: z.coerce.number().int().positive().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export const topUpIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const manualMatchBodySchema = z.object({
  provider: z.string().trim().min(1).max(30),
  providerReference: z.string().trim().min(1).max(120),
  amount: positiveAmount,
  userId: z.coerce.number().int().positive(),
  reason: z.string().trim().min(1).max(200),
  transferTime: z.string().datetime().optional(),
});

export const payoutListQuerySchema = financeListQuerySchema.extend({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'PAID', 'FAILED']).optional(),
  requestType: z.enum(['WITHDRAWAL', 'OWNER_PAYOUT']).optional(),
  userId: z.coerce.number().int().positive().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export const payoutIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const payoutActionBodySchema = z.object({
  note: z.string().trim().max(200).optional(),
  transferReference: z.string().trim().max(120).optional(),
});

export const refundListQuerySchema = financeListQuerySchema.extend({
  status: z.enum(['PENDING', 'PROCESSING', 'REFUNDED', 'FAILED']).optional(),
  paymentId: z.coerce.number().int().positive().optional(),
  userId: z.coerce.number().int().positive().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export const refundParamSchema = z.object({
  paymentId: z.coerce.number().int().positive(),
});

export const refundResolveBodySchema = z.object({
  note: z.string().trim().min(1).max(500),
});

export const ownerEarningsQuerySchema = financeListQuerySchema.extend({
  ownerId: z.coerce.number().int().positive().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export const ownerEarningSweepBodySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
  dryRun: z.boolean().default(false),
});

export const ownerEarningReversalBodySchema = z.object({
  reason: z.string().trim().min(1).max(200),
});

export const bookingIdParamSchema = z.object({
  bookingId: z.coerce.number().int().positive(),
});

export const reconciliationQuerySchema = financeRangeQuerySchema;

export const reconciliationResolveBodySchema = z.object({
  key: z.string().trim().min(1).max(200).optional(),
  note: z.string().trim().min(1).max(500),
});

export const reconciliationKeyParamSchema = z.object({
  key: z.string().trim().min(1).max(200),
});

export const reportQuerySchema = financeRangeQuerySchema.extend({
  groupBy: z.enum(['day', 'source', 'owner']).default('day'),
});

export const exportParamSchema = z.object({
  type: z.enum(['transactions', 'top-ups', 'payouts', 'refunds', 'revenue', 'cash-flow', 'reconciliation']),
});

export const exportQuerySchema = z.object({
  range: z.enum(FINANCE_RANGES).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  groupBy: z.enum(['day', 'source', 'owner']).optional(),
  source: z.enum(['ledger', 'top-up', 'payout', 'refund']).optional(),
  status: z.string().trim().max(40).optional(),
  userId: z.coerce.number().int().positive().optional(),
  provider: z.string().trim().max(30).optional(),
  requestType: z.enum(['WITHDRAWAL', 'OWNER_PAYOUT']).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  referenceType: z.string().trim().max(40).optional(),
  referenceId: z.coerce.number().int().positive().optional(),
  minAmount: decimalAmount.optional(),
  maxAmount: decimalAmount.optional(),
});

export const auditQuerySchema = financeListQuerySchema.extend({
  action: z.string().trim().max(40).optional(),
  actorId: z.coerce.number().int().positive().optional(),
  entityType: z.string().trim().max(40).optional(),
  entityId: z.string().trim().max(80).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
