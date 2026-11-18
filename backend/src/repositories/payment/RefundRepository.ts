import { db } from '../../db';
import { paymentRefunds } from '../../db/schema/bookings';
import { eq, sql } from 'drizzle-orm';

type Executor = any;

export type PaymentRefundStatus = 'PENDING' | 'PROCESSING' | 'REFUNDED' | 'FAILED';

export interface PaymentRefundRecord {
  paymentId: number;
  status: PaymentRefundStatus;
  attempts: number;
  lastError: string | null;
  reason: string | null;
  claimedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class RefundRepository {
  async createIntent(paymentId: number, reason: string, executor: Executor = db): Promise<PaymentRefundRecord> {
    await executor
      .insert(paymentRefunds)
      .values({ paymentId, status: 'PENDING', reason })
      .onConflictDoNothing({ target: paymentRefunds.paymentId });
    const [row] = await executor.select().from(paymentRefunds).where(eq(paymentRefunds.paymentId, paymentId)).limit(1);
    return row as PaymentRefundRecord;
  }

  async findById(paymentId: number, executor: Executor = db, lock = false): Promise<PaymentRefundRecord | null> {
    let query = executor.select().from(paymentRefunds).where(eq(paymentRefunds.paymentId, paymentId));
    if (lock) query = query.for('update');
    const [row] = await query.limit(1);
    return (row as PaymentRefundRecord) || null;
  }

  async claimNext(processingTimeoutMinutes: number, executor: Executor = db): Promise<number | null> {
    const result = await executor.execute(sql`
      SELECT payment_id
      FROM payment_refunds
      WHERE (
        status IN ('PENDING', 'FAILED')
        OR (status = 'PROCESSING' AND claimed_at < now() - (${processingTimeoutMinutes} || ' minutes')::interval)
      ) AND attempts < 5
      ORDER BY created_at, payment_id
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);
    const row = result.rows?.[0] as { payment_id: number | string } | undefined;
    if (!row) return null;
    const paymentId = Number(row.payment_id);
    await executor
      .update(paymentRefunds)
      .set({
        status: 'PROCESSING',
        attempts: sql`${paymentRefunds.attempts} + 1`,
        claimedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(paymentRefunds.paymentId, paymentId));
    return paymentId;
  }

  async markRefunded(paymentId: number, executor: Executor = db): Promise<void> {
    const now = new Date();
    await executor
      .update(paymentRefunds)
      .set({ status: 'REFUNDED', completedAt: now, updatedAt: now, lastError: null })
      .where(eq(paymentRefunds.paymentId, paymentId));
  }

  async markFailed(paymentId: number, error: string, executor: Executor = db): Promise<void> {
    await executor
      .update(paymentRefunds)
      .set({ status: 'FAILED', lastError: error.slice(0, 2000), updatedAt: new Date() })
      .where(eq(paymentRefunds.paymentId, paymentId));
  }
}

export const refundRepository = new RefundRepository();
