import { z } from 'zod';

export const initiateBookingPaymentBodySchema = z.object({
  provider: z.enum(['WALLET', 'MOCK', 'VNPAY']).optional(),
});

export const mockConfirmPaymentBodySchema = z.object({
  bookingId: z.coerce.number().int().positive(),
  paymentId: z.coerce.number().int().positive(),
  simulateFailure: z.boolean().optional().default(false),
});

export const paymentIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
