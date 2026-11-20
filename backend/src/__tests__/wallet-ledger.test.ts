import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { db, walletHolds, walletLedgerEntries } from '../db';
import { eq } from 'drizzle-orm';
import { createTestUser } from './test-helpers';
import { walletService } from '../services/payments/WalletService';

async function entriesFor(userId: number) {
  return db.select().from(walletLedgerEntries).where(eq(walletLedgerEntries.userId, userId)).orderBy(walletLedgerEntries.id);
}

describe('Wallet ledger (WAL-01, D9)', () => {
  it('creates a wallet and credits once with an idempotency key', async () => {
    const user = await createTestUser();

    const first = await walletService.credit({
      userId: user.id,
      amount: '100000',
      entryType: 'TOP_UP',
      idempotencyKey: 'topup-1',
    });
    const replay = await walletService.credit({
      userId: user.id,
      amount: '100000',
      entryType: 'TOP_UP',
      idempotencyKey: 'topup-1',
    });

    expect(first.wallet.balance).toBe('100000.00');
    expect(first.wallet.available).toBe('100000.00');
    expect(replay.wallet.balance).toBe('100000.00');
    expect(replay.entry.id).toBe(first.entry.id);

    const entries = await entriesFor(user.id);
    expect(entries).toHaveLength(1);
    expect(entries[0].entryType).toBe('TOP_UP');
    expect(entries[0].amount).toBe('100000.00');
    expect(entries[0].balanceAfter).toBe('100000.00');
  });

  it('serves paginated transaction history for the authenticated wallet only', async () => {
    const user = await createTestUser();
    const other = await createTestUser();
    await walletService.credit({ userId: user.id, amount: '100000', entryType: 'TOP_UP', description: 'Nạp ví' });
    await walletService.debit({ userId: user.id, amount: '40000', entryType: 'PAYMENT', description: 'Thanh toán sân' });
    await walletService.credit({ userId: user.id, amount: '10000', entryType: 'REFUND', description: 'Hoàn tiền' });
    await walletService.credit({ userId: other.id, amount: '50000', entryType: 'TOP_UP' });

    const first = await request(app)
      .get('/api/v1/wallet/entries?page=1&limit=2')
      .set('x-user-id', String(user.id));
    expect(first.status).toBe(200);
    expect(first.body.data).toHaveLength(2);
    expect(first.body.data[0].entryType).toBe('REFUND');
    expect(first.body.data[0].amount).toBe('10000.00');
    expect(first.body.meta).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });

    const second = await request(app)
      .get('/api/v1/wallet/entries?page=2&limit=2')
      .set('x-user-id', String(user.id));
    expect(second.status).toBe(200);
    expect(second.body.data).toHaveLength(1);
    expect(second.body.data[0].entryType).toBe('TOP_UP');

    const isolated = await request(app)
      .get('/api/v1/wallet/entries')
      .set('x-user-id', String(other.id));
    expect(isolated.status).toBe(200);
    expect(isolated.body.meta.total).toBe(1);
  });

  it('rejects an idempotency key reused for a different amount', async () => {
    const user = await createTestUser();
    await walletService.credit({ userId: user.id, amount: '100', entryType: 'TOP_UP', idempotencyKey: 'same-key' });

    await expect(
      walletService.credit({ userId: user.id, amount: '200', entryType: 'TOP_UP', idempotencyKey: 'same-key' }),
    ).rejects.toMatchObject({ code: 'WALLET_IDEMPOTENCY_CONFLICT' });
  });

  it('debits only available balance and never goes negative', async () => {
    const user = await createTestUser();
    await walletService.credit({ userId: user.id, amount: '100000', entryType: 'TOP_UP' });

    await expect(
      walletService.debit({ userId: user.id, amount: '100001', entryType: 'PAYMENT' }),
    ).rejects.toMatchObject({ code: 'WALLET_INSUFFICIENT_BALANCE' });

    const result = await walletService.debit({
      userId: user.id,
      amount: '40000',
      entryType: 'PAYMENT',
      idempotencyKey: 'pay-1',
    });
    expect(result.wallet.balance).toBe('60000.00');
    expect(result.entry.amount).toBe('-40000.00');

    const entries = await entriesFor(user.id);
    expect(entries).toHaveLength(2);
    expect(entries[1].balanceAfter).toBe('60000.00');
  });

  it('holds reserve available balance without moving the ledger balance', async () => {
    const user = await createTestUser();
    await walletService.credit({ userId: user.id, amount: '100000', entryType: 'TOP_UP' });

    const held = await walletService.hold({
      userId: user.id,
      amount: '60000',
      referenceType: 'BOOKING',
      referenceId: 1,
      idempotencyKey: 'hold-1',
    });
    expect(held.wallet.balance).toBe('100000.00');
    expect(held.wallet.held).toBe('60000.00');
    expect(held.wallet.available).toBe('40000.00');

    await expect(
      walletService.debit({ userId: user.id, amount: '50000', entryType: 'PAYMENT' }),
    ).rejects.toMatchObject({ code: 'WALLET_INSUFFICIENT_BALANCE' });

    const released = await walletService.releaseHold(held.hold.id);
    expect(released.status).toBe('RELEASED');
    expect((await walletService.getWallet(user.id)).available).toBe('100000.00');
  });

  it('captures a hold exactly once and writes a ledger entry', async () => {
    const user = await createTestUser();
    await walletService.credit({ userId: user.id, amount: '100000', entryType: 'TOP_UP' });
    const held = await walletService.hold({
      userId: user.id,
      amount: '80000',
      referenceType: 'BOOKING',
      referenceId: 42,
    });

    const captured = await walletService.captureHold(held.hold.id, { entryType: 'PAYMENT' });
    expect(captured.wallet.balance).toBe('20000.00');
    expect(captured.wallet.held).toBe('0.00');
    expect(captured.wallet.available).toBe('20000.00');
    expect(captured.hold.status).toBe('CAPTURED');
    expect(captured.entry?.amount).toBe('-80000.00');

    const replay = await walletService.captureHold(held.hold.id, { entryType: 'PAYMENT' });
    expect(replay.wallet.balance).toBe('20000.00');
    expect(await entriesFor(user.id)).toHaveLength(2);

    await expect(walletService.releaseHold(held.hold.id)).rejects.toMatchObject({ code: 'WALLET_HOLD_CAPTURED' });
    expect(await db.select().from(walletHolds).where(eq(walletHolds.id, held.hold.id))).toHaveLength(1);
  });

  it('serializes concurrent debits so only one can overdraw', async () => {
    const user = await createTestUser();
    await walletService.credit({ userId: user.id, amount: '100000', entryType: 'TOP_UP' });

    const results = await Promise.allSettled([
      walletService.debit({ userId: user.id, amount: '60000', entryType: 'PAYMENT', idempotencyKey: 'pay-a' }),
      walletService.debit({ userId: user.id, amount: '60000', entryType: 'PAYMENT', idempotencyKey: 'pay-b' }),
    ]);

    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(r => r.status === 'rejected');
    expect(rejected && rejected.status === 'rejected' ? rejected.reason : null).toMatchObject({
      code: 'WALLET_INSUFFICIENT_BALANCE',
    });
    expect((await walletService.getWallet(user.id)).balance).toBe('40000.00');
  });

  it('admin adjustment requires a reason and records createdBy', async () => {
    const user = await createTestUser();
    const admin = await createTestUser({ role: 'ADMIN' });
    await walletService.credit({ userId: user.id, amount: '100000', entryType: 'TOP_UP' });

    const adjusted = await walletService.adminDebit({
      userId: user.id,
      amount: '25000',
      adminId: admin.id,
      description: 'Điều chỉnh sai số',
    });
    expect(adjusted.wallet.balance).toBe('75000.00');
    expect(adjusted.entry.createdBy).toBe(admin.id);
    expect(adjusted.entry.description).toBe('Điều chỉnh sai số');

    await expect(
      walletService.adminCredit({ userId: user.id, amount: '1000', adminId: admin.id }),
    ).rejects.toMatchObject({ code: 'WALLET_ADJUSTMENT_REASON_REQUIRED' });
  });
});
