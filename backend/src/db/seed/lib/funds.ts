import { sql } from 'drizzle-orm';
import { db } from '../../index';
import { walletService } from '../../../services/payments/WalletService';
import { walletTopUpService } from '../../../services/payments/WalletTopUpService';
import { stampAt, ts } from './stamp';

/**
 * Money is spent at back-dated times, but steps do not run in time order. A debit at time `at`
 * lowers every later running balance, so what can be spent at `at` is the smallest running
 * balance from `at` onwards — and never more than what the wallet service sees right now
 * (balance minus active holds), because the real service performs the debit.
 */
export async function spendableAt(userId: number, at: Date): Promise<number> {
  const result = await db.execute(sql`
    WITH entries AS (
      SELECT created_at, SUM(amount) OVER (ORDER BY created_at, id) AS running
      FROM wallet_ledger_entries WHERE user_id = ${userId}
    )
    SELECT
      COALESCE((SELECT running FROM entries WHERE created_at <= ${ts(at)} ORDER BY created_at DESC LIMIT 1), 0) AS at_time,
      (SELECT MIN(running) FROM entries WHERE created_at > ${ts(at)}) AS after_min`);
  const row = result.rows[0] as { at_time: string; after_min: string | null };
  const historical = Math.min(Number(row.at_time), row.after_min === null ? Infinity : Number(row.after_min));
  const wallet = await walletService.getWallet(userId);
  return Math.min(historical, Number(wallet.available));
}

let topUpSeq = 0;

/** Top the wallet up shortly before `at` (mock provider) when it cannot cover `amount` then. */
export async function ensureFunds(userId: number, amount: number, at: Date, notBefore: Date): Promise<void> {
  const available = await spendableAt(userId, at);
  if (available >= amount) return;
  const deficit = amount - available;
  const topUp = Math.ceil((deficit + 500_000) / 500_000) * 500_000;
  const earliest = notBefore.getTime() + 60_000;
  const when = new Date(Math.max(earliest, Math.min(at.getTime() - 2 * 3_600_000, at.getTime() - 60_000)));
  if (when.getTime() >= at.getTime()) throw new Error(`No room to top up user ${userId} before ${at.toISOString()}`);
  topUpSeq += 1;
  await stampAt(when, async () => {
    const created = await walletTopUpService.createTopUp({ userId, amount: topUp, provider: 'MOCK', idempotencyKey: `seed-refill-${userId}-${topUpSeq}` });
    await walletTopUpService.mockConfirm(created.topUpId, userId);
  });
}
