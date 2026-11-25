import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { payments, paymentRefunds } from '../../db/schema/bookings';
import { tournamentRegistrations } from '../../db/schema/tournaments';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { AppError } from '../../errors/AppError';
import { walletService } from '../payments/WalletService';

/**
 * Entry fees through the platform wallet (Tournament Tech Design §5, PRD Decisions #11, #12).
 * Every method runs inside the caller's transaction, after the tournament row is locked.
 * Idempotency keys make each money movement at-most-once per registration / tournament.
 */

const REFERENCE_TYPE = 'TOURNAMENT_REGISTRATION';

type RegistrationRow = typeof tournamentRegistrations.$inferSelect;

export interface ChargeInput {
  registrationId: number;
  tournamentId: number;
  tournamentName: string;
  payerId: number;
  amount: number;
}

const money = (value: number | string) => Number(value).toFixed(2);

export class TournamentFeeService {
  /** Debits the fee and records a `payments` row. Insufficient balance aborts the whole registration. */
  async charge(input: ChargeInput, tx: TransactionContext): Promise<void> {
    if (input.amount <= 0) return;
    try {
      await walletService.debit({
        userId: input.payerId,
        amount: money(input.amount),
        entryType: 'PAYMENT',
        referenceType: REFERENCE_TYPE,
        referenceId: input.registrationId,
        idempotencyKey: `trn-reg:${input.registrationId}`,
        description: `Lệ phí giải ${input.tournamentName}`.slice(0, 200),
        createdBy: input.payerId,
      }, tx);
    } catch (error) {
      if (error instanceof AppError && error.code === 'WALLET_INSUFFICIENT_BALANCE') {
        const wallet = await walletService.getWallet(input.payerId, tx);
        throw new AppError('WALLET_INSUFFICIENT_BALANCE', 409, 'Wallet balance is insufficient for the entry fee', [
          { field: 'wallet', code: 'WALLET_INSUFFICIENT_BALANCE', required: money(input.amount), balance: wallet.available },
        ]);
      }
      throw error;
    }
    await tx.insert(payments).values({
      registrationId: input.registrationId,
      amount: money(input.amount),
      provider: 'WALLET',
      paymentMethod: 'WALLET',
      status: 'SUCCESS',
      transactionId: `TRN-REG-${input.registrationId}`,
      paidAt: new Date(),
    });
  }

  /**
   * Refunds 100% of a paid registration to the payer's wallet, once. Marks the payment
   * `REFUNDED`, records `payment_refunds` (Finance sees it like a booking refund) and sets
   * `refunded_at`. No-op for free or already refunded registrations.
   */
  async refund(registration: RegistrationRow, reason: string, tx: TransactionContext): Promise<boolean> {
    const amount = Number(registration.paidAmount);
    if (amount <= 0 || registration.refundedAt !== null || registration.payerId === null) return false;
    await walletService.credit({
      userId: registration.payerId,
      amount: money(amount),
      entryType: 'REFUND',
      referenceType: REFERENCE_TYPE,
      referenceId: registration.id,
      idempotencyKey: `trn-refund:${registration.id}`,
      description: `Hoàn lệ phí giải đấu (${reason})`.slice(0, 200),
    }, tx);
    const now = new Date();
    const [payment] = await tx.update(payments).set({ status: 'REFUNDED', updatedAt: now })
      .where(eq(payments.registrationId, registration.id)).returning({ id: payments.id });
    if (payment) {
      await tx.insert(paymentRefunds).values({
        paymentId: payment.id, status: 'REFUNDED', reason: reason.slice(0, 200), completedAt: now, updatedAt: now,
      }).onConflictDoNothing();
    }
    await tx.update(tournamentRegistrations).set({ refundedAt: now, updatedAt: now })
      .where(eq(tournamentRegistrations.id, registration.id));
    return true;
  }

  /**
   * Refunds every paid, not yet refunded CONFIRMED registration (tournament cancellation).
   * Ordered by payer id so wallet locks are always taken in ascending order.
   */
  async refundAll(tournamentId: number, reason: string, tx: TransactionContext): Promise<number> {
    const rows = await tx.select().from(tournamentRegistrations)
      .where(and(
        eq(tournamentRegistrations.tournamentId, tournamentId),
        eq(tournamentRegistrations.status, 'CONFIRMED'),
        isNull(tournamentRegistrations.refundedAt),
        sql`${tournamentRegistrations.paidAmount} > 0`,
      ))
      .orderBy(asc(tournamentRegistrations.payerId), asc(tournamentRegistrations.id));
    let refunded = 0;
    for (const row of rows) if (await this.refund(row, reason, tx)) refunded += 1;
    return refunded;
  }

  /** Credits the Organizer with the fees of registrations still held (completion), once. */
  async creditOrganizer(tournament: { id: number; creatorId: number; name: string }, tx: TransactionContext): Promise<string> {
    const [{ total }] = await tx.select({ total: sql<string>`coalesce(sum(${tournamentRegistrations.paidAmount}), 0)::numeric(14,2)::text` })
      .from(tournamentRegistrations)
      .where(and(
        eq(tournamentRegistrations.tournamentId, tournament.id),
        eq(tournamentRegistrations.status, 'CONFIRMED'),
        isNull(tournamentRegistrations.refundedAt),
      ));
    if (Number(total) <= 0) return '0.00';
    await walletService.credit({
      userId: tournament.creatorId,
      amount: total,
      entryType: 'TOURNAMENT_EARNING',
      referenceType: 'TOURNAMENT',
      referenceId: tournament.id,
      idempotencyKey: `trn-earning:${tournament.id}`,
      description: `Lệ phí giải ${tournament.name}`.slice(0, 200),
    }, tx);
    return total;
  }
}

export const tournamentFeeService = new TournamentFeeService();
