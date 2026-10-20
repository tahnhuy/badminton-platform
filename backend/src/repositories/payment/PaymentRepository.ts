import { db, payments } from '../../db';
import { eq, sql } from 'drizzle-orm';

type Executor = any;

export type PaymentStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'EXPIRED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'REFUND_FAILED';

export interface NewPaymentData {
  bookingId?: number | null;
  registrationId?: number | null;
  amount: string;
  provider: string;
  paymentMethod: string;
  transactionId?: string | null;
  status: PaymentStatus;
  paidAt?: Date | null;
}

export interface PaymentRecord {
  id: number;
  bookingId: number | null;
  registrationId: number | null;
  amount: string;
  provider: string;
  paymentMethod: string;
  transactionId: string | null;
  status: PaymentStatus;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class PaymentRepository {
  async create(data: NewPaymentData, executor: Executor = db): Promise<PaymentRecord> {
    const [inserted] = await executor
      .insert(payments)
      .values({
        bookingId: data.bookingId ?? null,
        registrationId: data.registrationId ?? null,
        amount: data.amount,
        provider: data.provider,
        paymentMethod: data.paymentMethod,
        transactionId: data.transactionId ?? null,
        status: data.status,
        paidAt: data.paidAt ?? null,
      })
      .returning();

    return inserted as PaymentRecord;
  }

  async findById(id: number, executor: Executor = db): Promise<PaymentRecord | null> {
    const [row] = await executor
      .select()
      .from(payments)
      .where(eq(payments.id, id))
      .limit(1);

    return (row as PaymentRecord) || null;
  }

  async findByBookingId(bookingId: number, executor: Executor = db): Promise<PaymentRecord | null> {
    const [row] = await executor
      .select()
      .from(payments)
      .where(eq(payments.bookingId, bookingId))
      .orderBy(sql`${payments.id} DESC`)
      .limit(1);

    return (row as PaymentRecord) || null;
  }

  async findByTransactionId(transactionId: string, executor: Executor = db): Promise<PaymentRecord | null> {
    const [row] = await executor
      .select()
      .from(payments)
      .where(eq(payments.transactionId, transactionId))
      .limit(1);

    return (row as PaymentRecord) || null;
  }

  async lockById(id: number, executor: Executor): Promise<PaymentRecord | null> {
    const [row] = await executor
      .select()
      .from(payments)
      .where(eq(payments.id, id))
      .for('update')
      .limit(1);

    return (row as PaymentRecord) || null;
  }

  async updateStatus(
    id: number,
    status: PaymentStatus,
    paidAt?: Date | null,
    executor: Executor = db
  ): Promise<void> {
    const values: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };
    if (paidAt !== undefined) {
      values.paidAt = paidAt;
    }
    await executor
      .update(payments)
      .set(values)
      .where(eq(payments.id, id));
  }

  async updateTransactionId(
    id: number,
    transactionId: string,
    executor: Executor = db
  ): Promise<void> {
    await executor
      .update(payments)
      .set({
        transactionId,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, id));
  }
}

export const paymentRepository = new PaymentRepository();
