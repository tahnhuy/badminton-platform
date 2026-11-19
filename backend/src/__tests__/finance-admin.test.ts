import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { eq } from 'drizzle-orm';
import { app } from '../app';
import { db, bookings, courts, facilities, paymentRefunds, payments, systemConfigs, walletLedgerEntries, walletTopUps } from '../db';
import { financeAuditEvents } from '../db/schema/finance';
import { createTestUser } from './test-helpers';
import { walletService } from '../services/payments/WalletService';
import { walletPayoutService } from '../services/payments/WalletPayoutService';
import { paymentService } from '../services/payments/payment.service';
import { refundRepository } from '../repositories/payment/RefundRepository';
import { ownerEarningService } from '../services/finance/OwnerEarningService';
import { reconciliationService } from '../services/finance/ReconciliationService';
import { financeQueryService } from '../services/finance/FinanceQueryService';
import { clearConfigCache } from '../shared/config/config-registry';

const BOOKING_DATE = new Date().toISOString().slice(0, 10);

async function setAutoApprovePayouts(value: boolean): Promise<void> {
  await db.insert(systemConfigs).values({
    configKey: 'WALLET_AUTO_APPROVE_PAYOUTS',
    configValue: String(value),
    description: 'Automatically approve wallet payout requests (sandbox/demo); Admin still marks paid',
  }).onConflictDoUpdate({
    target: systemConfigs.configKey,
    set: { configValue: String(value), updatedAt: new Date() },
  });
  clearConfigCache();
}

async function createFixture() {
  const admin = await createTestUser({ role: 'ADMIN' });
  const player = await createTestUser({ role: 'PLAYER' });
  const owner = await createTestUser({ role: 'COURT_OWNER' });
  const [facility] = await db.insert(facilities).values({
    ownerId: owner.id,
    name: 'Finance Court',
    phone: '0900000000',
    status: 'ACTIVE',
    address: '1 Finance',
    district: 'Quận 1',
    city: 'Hồ Chí Minh',
    latitude: '10.7',
    longitude: '106.7',
    openingTime: '06:00:00',
    closingTime: '23:00:00',
  }).returning();
  const [court] = await db.insert(courts).values({ facilityId: facility.id, name: 'Sân 1', status: 'ACTIVE' }).returning();
  const [booking] = await db.insert(bookings).values({
    playerId: player.id,
    courtId: court.id,
    bookingDate: BOOKING_DATE,
    startTime: '18:00:00',
    endTime: '19:00:00',
    unitPrice: '100000',
    totalAmount: '100000',
    status: 'PENDING_PAYMENT',
    bookingCode: `FIN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  }).returning();
  return { admin, player, owner, facility, court, booking };
}

async function payBooking(playerId: number, bookingId: number) {
  const [topUp] = await db.insert(walletTopUps).values({
    userId: playerId,
    amount: '100000',
    status: 'SUCCESS',
    provider: 'MOCK',
    txnRef: `FIN-TOPUP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    paidAt: new Date(),
  }).returning();
  await walletService.credit({
    userId: playerId,
    amount: '100000',
    entryType: 'TOP_UP',
    referenceType: 'TOP_UP',
    referenceId: topUp.id,
    idempotencyKey: `wallet-topup:${topUp.id}`,
  });
  await paymentService.createBookingPayment({ bookingId, actorId: playerId, provider: 'WALLET' });
  await db.update(bookings).set({ status: 'COMPLETED' }).where(eq(bookings.id, bookingId));
}

describe('Admin finance module', () => {
  beforeEach(async () => {
    await setAutoApprovePayouts(false);
  });

  it('restricts finance endpoints to ADMIN', async () => {
    const player = await createTestUser({ role: 'PLAYER' });
    const denied = await request(app).get('/api/v1/admin/finance/overview').set('x-user-id', String(player.id));
    expect(denied.status).toBe(403);
    const anonymous = await request(app).get('/api/v1/admin/finance/transactions');
    expect(anonymous.status).toBe(401);
  });

  it('rejects malformed date and amount filters with a validation error', async () => {
    const { admin } = await createFixture();
    const paths = [
      '/api/v1/admin/finance/overview?range=custom&startDate=2026-02-31&endDate=2026-03-01',
      '/api/v1/admin/finance/transactions?minAmount=abc',
      '/api/v1/admin/finance/reports/revenue?range=custom&startDate=2026-13-01&endDate=2026-12-01',
      '/api/v1/admin/finance/exports/transactions?maxAmount=1e3',
    ];
    for (const path of paths) {
      const res = await request(app).get(path).set('x-user-id', String(admin.id));
      expect(res.status, path).toBe(400);
      expect(res.body.error.code, path).toBe('VALIDATION_FAILED');
    }

    const badAmount = await request(app)
      .post('/api/v1/admin/finance/top-ups/1/manual-match')
      .set('x-user-id', String(admin.id))
      .send({ provider: 'SEPAY', providerReference: 'BAD-REF', amount: 'abc', userId: 1, reason: 'x' });
    expect(badAmount.status).toBe(400);
    expect(badAmount.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('returns overview, transactions, and reports from real money movements', async () => {
    const { admin, player, booking } = await createFixture();
    await payBooking(player.id, booking.id);

    const overview = await request(app)
      .get('/api/v1/admin/finance/overview?range=30d')
      .set('x-user-id', String(admin.id));
    expect(overview.status).toBe(200);
    expect(Number(overview.body.data.grossRevenue)).toBe(100000);

    const transactions = await request(app)
      .get('/api/v1/admin/finance/transactions')
      .set('x-user-id', String(admin.id));
    expect(transactions.status).toBe(200);
    expect(transactions.body.data.some((row: any) => row.type === 'PAYMENT' && row.amount === '-100000.00')).toBe(true);

    const revenue = await request(app)
      .get('/api/v1/admin/finance/reports/revenue?range=30d&groupBy=source')
      .set('x-user-id', String(admin.id));
    expect(revenue.status).toBe(200);
    expect(revenue.body.data.rows.find((row: any) => row.key === 'booking').gross).toBe('100000.00');
  });

  it('shows a wallet and records credit/debit with audit', async () => {
    const { admin, player } = await createFixture();
    await walletService.credit({ userId: player.id, amount: '50000', entryType: 'TOP_UP' });

    const wallet = await request(app).get(`/api/v1/admin/finance/wallets/${player.id}`).set('x-user-id', String(admin.id));
    expect(wallet.status).toBe(200);
    expect(wallet.body.data.balance).toBe('50000.00');
    expect(wallet.body.data.available).toBe('50000.00');

    const credit = await request(app)
      .post(`/api/v1/admin/finance/wallets/${player.id}/credit`)
      .set('x-user-id', String(admin.id))
      .send({ amount: '10000', reason: 'Goodwill' });
    expect(credit.status).toBe(200);
    expect(credit.body.data.wallet.balance).toBe('60000.00');

    const debit = await request(app)
      .post(`/api/v1/admin/finance/wallets/${player.id}/debit`)
      .set('x-user-id', String(admin.id))
      .send({ amount: '5000', reason: 'Correction' });
    expect(debit.status).toBe(200);
    expect(debit.body.data.wallet.balance).toBe('55000.00');

    const audits = await db.select().from(financeAuditEvents).where(eq(financeAuditEvents.entityType, 'WALLET'));
    expect(audits.map(row => row.action)).toEqual(expect.arrayContaining(['WALLET_CREDIT', 'WALLET_DEBIT']));
  });

  it('lists top-ups and supports an idempotent manual match', async () => {
    const { admin, player } = await createFixture();
    const match = await request(app)
      .post('/api/v1/admin/finance/top-ups/1/manual-match')
      .set('x-user-id', String(admin.id))
      .send({ provider: 'SEPAY', providerReference: 'BANK-REF-1', amount: '25000', userId: player.id, reason: 'Missing webhook' });
    expect(match.status).toBe(200);
    expect((await walletService.getWallet(player.id)).balance).toBe('25000.00');

    const replay = await request(app)
      .post('/api/v1/admin/finance/top-ups/1/manual-match')
      .set('x-user-id', String(admin.id))
      .send({ provider: 'SEPAY', providerReference: 'BANK-REF-1', amount: '25000', userId: player.id, reason: 'Retry' });
    expect(replay.status).toBe(200);
    expect((await walletService.getWallet(player.id)).balance).toBe('25000.00');

    const topUps = await request(app)
      .get('/api/v1/admin/finance/top-ups')
      .set('x-user-id', String(admin.id));
    expect(topUps.status).toBe(200);
    expect(topUps.body.data).toHaveLength(1);
  });

  it('approves and marks a payout paid through the finance API', async () => {
    const { admin, player } = await createFixture();
    await walletService.credit({ userId: player.id, amount: '100000', entryType: 'TOP_UP' });
    const bank = await walletPayoutService.createBankAccount(player.id, {
      bankCode: 'MBBank', accountNumber: '0123456789', accountName: 'PLAYER',
    });
    const payout = await walletPayoutService.createRequest(player.id, {
      requestType: 'WITHDRAWAL', amount: '60000', bankAccountId: bank.id,
    });

    const list = await request(app)
      .get('/api/v1/admin/finance/payouts?status=PENDING')
      .set('x-user-id', String(admin.id));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);

    const approved = await request(app)
      .post(`/api/v1/admin/finance/payouts/${payout.id}/approve`)
      .set('x-user-id', String(admin.id))
      .send({ note: 'OK' });
    expect(approved.status).toBe(200);

    const paid = await request(app)
      .post(`/api/v1/admin/finance/payouts/${payout.id}/paid`)
      .set('x-user-id', String(admin.id))
      .send({ transferReference: 'TX-1' });
    expect(paid.status).toBe(200);
    expect((await walletService.getWallet(player.id)).balance).toBe('40000.00');

    const audit = await db.select().from(financeAuditEvents).where(eq(financeAuditEvents.entityType, 'PAYOUT'));
    expect(audit.map(row => row.action)).toEqual(expect.arrayContaining(['PAYOUT_APPROVE', 'PAYOUT_MARK_PAID']));
  });

  it('retries a failed refund exactly once', async () => {
    const { admin, player, booking } = await createFixture();
    await walletService.credit({ userId: player.id, amount: '100000', entryType: 'TOP_UP' });
    const payment = await paymentService.createBookingPayment({ bookingId: booking.id, actorId: player.id, provider: 'WALLET' });
    const [refund] = await db.insert(paymentRefunds).values({
      paymentId: payment.paymentId, status: 'FAILED', reason: 'test', attempts: 1, lastError: 'boom',
    }).returning();

    const retried = await request(app)
      .post(`/api/v1/admin/finance/refunds/${refund.paymentId}/retry`)
      .set('x-user-id', String(admin.id));
    expect(retried.status).toBe(200);

    const updated = await refundRepository.findById(refund.paymentId);
    expect(updated?.status).toBe('REFUNDED');
    expect((await walletService.getWallet(player.id)).balance).toBe('100000.00');
  });

  it('settles owner earnings and reconciles a clean fixture', async () => {
    const { admin, player, owner, booking } = await createFixture();
    await payBooking(player.id, booking.id);

    expect((await walletService.getWallet(owner.id)).balance).toBe('100000.00');

    const sweep = await ownerEarningService.sweep({ limit: 10 });
    expect(sweep.scanned).toBe(0);
    expect((await walletService.getWallet(owner.id)).balance).toBe('100000.00');

    const reconciliation = await reconciliationService.run({ range: '30d' });
    expect(reconciliation.discrepancies).toEqual([]);

    const entries = await db.select().from(walletLedgerEntries).where(eq(walletLedgerEntries.entryType, 'OWNER_EARNING'));
    expect(entries).toHaveLength(1);
    expect(entries[0].referenceType).toBe('BOOKING');
  });

  it('downloads an audited Excel export', async () => {
    const { admin, player, booking } = await createFixture();
    await payBooking(player.id, booking.id);

    const response = await request(app)
      .get('/api/v1/admin/finance/exports/transactions?range=30d')
      .set('x-user-id', String(admin.id))
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(1000);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(response.body);
    expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(expect.arrayContaining(['Tổng hợp', 'Giao dịch']));

    const audits = await db.select().from(financeAuditEvents).where(eq(financeAuditEvents.action, 'EXPORT'));
    expect(audits).toHaveLength(1);
  });

  it('exposes finance overview with estimate labels and empty zero state', async () => {
    const { admin } = await createFixture();
    const empty = await request(app)
      .get('/api/v1/admin/finance/overview?range=today')
      .set('x-user-id', String(admin.id));
    expect(empty.status).toBe(200);
    expect(empty.body.data.isEstimate).toBe(true);
    expect(Number(empty.body.data.grossRevenue)).toBe(0);
  });
});
