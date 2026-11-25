import { reconciliationService } from '../services/finance/ReconciliationService';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
import { app } from '../app';
import {
  db,
  bookings,
  courts,
  facilities,
  notifications,
  ownerEarningSettlements,
  systemConfigs,
  walletLedgerEntries,
  walletTopUps,
} from '../db';
import { financeAuditEvents } from '../db/schema/finance';
import { createTestUser } from './test-helpers';
import { walletService } from '../services/payments/WalletService';
import { paymentService } from '../services/payments/payment.service';
import { ownerEarningService } from '../services/finance/OwnerEarningService';
import { refundService } from '../services/payments/RefundService';
import { financeConfig } from '../shared/config/finance-config';
import { clearConfigCache } from '../shared/config/config-registry';

const BOOKING_DATE = new Date().toISOString().slice(0, 10);

async function setAutoCredit(value: boolean): Promise<void> {
  await db.insert(systemConfigs).values({
    configKey: 'OWNER_EARNING_AUTO_CREDIT_ENABLED',
    configValue: String(value),
    description: 'Automatically credit the court Owner wallet when a booking completes',
  }).onConflictDoUpdate({
    target: systemConfigs.configKey,
    set: { configValue: String(value), updatedAt: new Date() },
  });
  clearConfigCache();
  await financeConfig.getOwnerEarningConfig();
}

async function resetAutoCredit(): Promise<void> {
  await setAutoCredit(true);
}

async function createFixture() {
  const admin = await createTestUser({ role: 'ADMIN' });
  const player = await createTestUser({ role: 'PLAYER' });
  const owner = await createTestUser({ role: 'COURT_OWNER' });
  const [facility] = await db.insert(facilities).values({
    ownerId: owner.id,
    name: 'Owner Earning Court',
    phone: '0900000000',
    status: 'ACTIVE',
    address: '1 Owner Earning',
    district: 'Quận 1',
    city: 'Hồ Chí Minh',
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
    bookingCode: `OE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  }).returning();
  return { admin, player, owner, booking };
}

async function completePaidBooking(playerId: number, bookingId: number) {
  const [topUp] = await db.insert(walletTopUps).values({
    userId: playerId,
    amount: '100000',
    status: 'SUCCESS',
    provider: 'MOCK',
    txnRef: `OE-TOPUP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

describe('Owner earning settlement switch', () => {
  beforeEach(async () => {
    await resetAutoCredit();
  });

  afterEach(async () => {
    await resetAutoCredit();
  });

  it('auto-credits the Owner wallet when the switch is on', async () => {
    const { player, owner, booking } = await createFixture();
    await completePaidBooking(player.id, booking.id);

    expect((await walletService.getWallet(owner.id)).balance).toBe('100000.00');

    const [settlement] = await db.select().from(ownerEarningSettlements);
    expect(settlement).toMatchObject({ status: 'CREDITED', mode: 'AUTO', amount: '100000.00' });
    expect(settlement.ledgerEntryId).not.toBeNull();

    const sweep = await ownerEarningService.sweep({ limit: 10 });
    expect(sweep.scanned).toBe(0);
    expect((await walletService.getWallet(owner.id)).balance).toBe('100000.00');
  });

  it('creates a pending settlement and only credits after Admin approval when the switch is off', async () => {
    const { admin, player, owner, booking } = await createFixture();
    await setAutoCredit(false);
    await completePaidBooking(player.id, booking.id);

    expect((await walletService.getWallet(owner.id)).balance).toBe('0.00');

    const [pending] = await db.select().from(ownerEarningSettlements);
    expect(pending).toMatchObject({ status: 'PENDING', mode: 'MANUAL' });
    expect(pending.ledgerEntryId).toBeNull();

    const adminAlerts = await db.select().from(notifications).where(and(
      eq(notifications.userId, admin.id),
      eq(notifications.type, 'ADMIN_OWNER_EARNING_PENDING'),
    ));
    expect(adminAlerts).toHaveLength(1);

    const reconciliation = await reconciliationService.run({ range: '30d' });
    expect(reconciliation.discrepancies.filter(item => item.entityType === 'BOOKING')).toEqual([]);

    const approved = await request(app)
      .post(`/api/v1/admin/finance/owner-earning-settlements/${pending.id}/approve`)
      .set('x-user-id', String(admin.id))
      .send({ note: 'Đã kiểm tra' });
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('CREDITED');
    expect((await walletService.getWallet(owner.id)).balance).toBe('100000.00');

    const repeated = await request(app)
      .post(`/api/v1/admin/finance/owner-earning-settlements/${pending.id}/approve`)
      .set('x-user-id', String(admin.id))
      .send({});
    expect(repeated.status).toBe(200);
    expect((await walletService.getWallet(owner.id)).balance).toBe('100000.00');

    const entries = await db.select().from(walletLedgerEntries).where(eq(walletLedgerEntries.entryType, 'OWNER_EARNING'));
    expect(entries).toHaveLength(1);

    const audits = await db.select().from(financeAuditEvents).where(eq(financeAuditEvents.action, 'OWNER_EARNING_APPROVE'));
    expect(audits).toHaveLength(1);
  });

  it('rejects a pending settlement and never credits the Owner wallet', async () => {
    const { admin, player, owner, booking } = await createFixture();
    await setAutoCredit(false);
    await completePaidBooking(player.id, booking.id);
    const [pending] = await db.select().from(ownerEarningSettlements);

    const missingReason = await request(app)
      .post(`/api/v1/admin/finance/owner-earning-settlements/${pending.id}/reject`)
      .set('x-user-id', String(admin.id))
      .send({});
    expect(missingReason.status).toBe(400);

    const rejected = await request(app)
      .post(`/api/v1/admin/finance/owner-earning-settlements/${pending.id}/reject`)
      .set('x-user-id', String(admin.id))
      .send({ reason: 'Sai thông tin' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe('REJECTED');
    expect((await walletService.getWallet(owner.id)).balance).toBe('0.00');

    const entries = await db.select().from(walletLedgerEntries).where(eq(walletLedgerEntries.entryType, 'OWNER_EARNING'));
    expect(entries).toHaveLength(0);

    const approveRejected = await request(app)
      .post(`/api/v1/admin/finance/owner-earning-settlements/${pending.id}/approve`)
      .set('x-user-id', String(admin.id))
      .send({});
    expect(approveRejected.status).toBe(409);
  });

  it('lists settlements and keeps approval endpoints Admin-only', async () => {
    const { admin, player, booking } = await createFixture();
    await setAutoCredit(false);
    await completePaidBooking(player.id, booking.id);

    const list = await request(app)
      .get('/api/v1/admin/finance/owner-earning-settlements?status=PENDING')
      .set('x-user-id', String(admin.id));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ mode: 'MANUAL', status: 'PENDING' });

    const denied = await request(app)
      .get('/api/v1/admin/finance/owner-earning-settlements')
      .set('x-user-id', String(player.id));
    expect(denied.status).toBe(403);
  });

  it('reverses an automatically credited earning when the payment is refunded', async () => {
    const { player, owner, booking } = await createFixture();
    await completePaidBooking(player.id, booking.id);
    expect((await walletService.getWallet(owner.id)).balance).toBe('100000.00');

    await db.transaction(tx => refundService.createBookingRefundIntent(booking.id, 'Test refund', tx));
    await refundService.processPending();

    expect((await walletService.getWallet(owner.id)).balance).toBe('0.00');
    expect((await walletService.getWallet(player.id)).balance).toBe('100000.00');
    const entries = await db.select().from(walletLedgerEntries);
    expect(entries.some(entry => entry.entryType === 'OWNER_EARNING_REVERSAL')).toBe(true);
  });

  it('keeps insufficient Owner recovery visible until a successful idempotent retry', async () => {
    const { admin, player, owner, booking } = await createFixture();
    await completePaidBooking(player.id, booking.id);
    await walletService.debit({ userId: owner.id, amount: '100000', entryType: 'ADMIN_ADJUSTMENT', description: 'Spent earnings' });
    await db.transaction(tx => refundService.createBookingRefundIntent(booking.id, 'Refund after spending', tx));
    await refundService.processPending();
    expect((await walletService.getWallet(player.id)).balance).toBe('100000.00');
    const key = `OWNER_EARNING_REVERSAL_PENDING:${booking.id}`;
    expect((await reconciliationService.run({ range: '30d' })).discrepancies.some(row => row.key === key)).toBe(true);
    await expect(ownerEarningService.reverse(booking.id, admin.id, 'Retry recovery')).rejects.toMatchObject({ code: 'FINANCE_OWNER_EARNING_INSUFFICIENT_BALANCE' });
    await reconciliationService.resolve(key, admin.id, 'Investigating');
    expect((await reconciliationService.run({ range: '30d' })).discrepancies.some(row => row.key === key)).toBe(true);
    await walletService.credit({ userId: owner.id, amount: '100000', entryType: 'ADMIN_ADJUSTMENT', description: 'Funds available' });
    await Promise.all([ownerEarningService.reverse(booking.id, admin.id, 'Retry recovery'), ownerEarningService.reverse(booking.id, admin.id, 'Repeated retry')]);
    expect((await walletService.getWallet(owner.id)).balance).toBe('0.00');
    expect((await reconciliationService.run({ range: '30d' })).discrepancies.some(row => row.key === key)).toBe(false);
  });

  it('exposes the new finance config key with a true default', async () => {
    const { admin } = await createFixture();
    const response = await request(app)
      .get('/api/v1/admin/configs/OWNER_EARNING_AUTO_CREDIT_ENABLED')
      .set('x-user-id', String(admin.id));
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      configKey: 'OWNER_EARNING_AUTO_CREDIT_ENABLED',
      domain: 'finance',
      valueType: 'boolean',
      documentedDefault: 'true',
      editable: true,
    });
  });
});
