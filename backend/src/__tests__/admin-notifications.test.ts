import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
import { app } from '../app';
import { db, posts, notifications, paymentRefunds, payments, systemConfigs, systemConfigAudit, facilities, courts, bookings } from '../db';
import { createTestUser, TEST_WITHDRAWAL_PIN, ensureWithdrawalPin } from './test-helpers';
import { walletService } from '../services/payments/WalletService';
import { walletPayoutService } from '../services/payments/WalletPayoutService';
import { walletTopUpService } from '../services/payments/WalletTopUpService';
import { refundService } from '../services/payments/RefundService';
import { env } from '../shared/config/env';
import { clearConfigCache } from '../shared/config/config-registry';

// Admin inbox producers: new reports and pending facility/court submissions
// notify every active Admin inside the caller's transaction.

const asUser = (id: number) => ({
  get: (url: string) => request(app).get(url).set('x-user-id', String(id)),
  post: (url: string, body?: unknown) => {
    const req = request(app).post(url).set('x-user-id', String(id));
    return body === undefined ? req : req.send(body as object);
  },
});

async function setAutoApprove(value: boolean) {
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

async function adminNotification(adminId: number, type: string) {
  const [row] = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, adminId), eq(notifications.type, type)))
    .limit(1);
  return row ?? null;
}

describe('Admin notifications', () => {
  let adminOne: number;
  let adminTwo: number;
  let player: number;
  let owner: number;

  beforeEach(async () => {
    adminOne = (await createTestUser({ role: 'ADMIN' })).id;
    adminTwo = (await createTestUser({ role: 'ADMIN' })).id;
    await createTestUser({ role: 'ADMIN', status: 'SUSPENDED' });
    player = (await createTestUser({ role: 'PLAYER' })).id;
    owner = (await createTestUser({ role: 'COURT_OWNER' })).id;
  });

  it('notifies every active Admin when a Player submits a report and links to the Admin queue', async () => {
    const author = (await createTestUser({ role: 'PLAYER' })).id;
    const [post] = await db.insert(posts).values({
      authorId: author, type: 'FREE', body: 'reported post', publishedAt: new Date(), creationHash: 'a'.repeat(64),
    }).returning();

    const created = await asUser(player).post('/api/v1/reports', {
      targetType: 'POST', targetId: post.id, reasonCode: 'SPAM',
    });
    expect(created.status).toBe(201);

    for (const adminId of [adminOne, adminTwo]) {
      const notification = await adminNotification(adminId, 'ADMIN_REPORT_CREATED');
      expect(notification).not.toBeNull();
      expect(notification!.resourceType).toBe('ADMIN_REPORT');
      expect(notification!.content).toContain(`#${created.body.data.id}`);

      const detail = await asUser(adminId).get(`/api/v1/notifications/${notification!.id}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.resourcePath).toBe(`/admin/reports?reportId=${created.body.data.id}`);
    }

    expect(await adminNotification(player, 'ADMIN_REPORT_CREATED')).toBeNull();
    expect(await adminNotification(owner, 'ADMIN_REPORT_CREATED')).toBeNull();
  });

  it('does not resolve an Admin resource for a non-Admin recipient', async () => {
    const [row] = await db.insert(notifications).values({
      userId: player, type: 'ADMIN_REPORT_CREATED', title: 'Báo cáo mới', content: 'Báo cáo #1',
      resourceType: 'ADMIN_REPORT', resourceId: 1, dedupKey: 'test:admin-resource:player',
    }).returning();

    const detail = await asUser(player).get(`/api/v1/notifications/${row.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.resourcePath).toBeNull();
  });

  it('notifies Admins when a payout is pending, but not when it is auto-approved', async () => {
    await setAutoApprove(false);
    await walletService.credit({ userId: player, amount: '100000', entryType: 'TOP_UP' });
    const bank = await walletPayoutService.createBankAccount(player, {
      bankCode: 'MBBank', accountNumber: '0123456789', accountName: 'NGUYEN VAN A',
    });
    await ensureWithdrawalPin(player);
    const request = await walletPayoutService.createRequest(player, {
      requestType: 'WITHDRAWAL', amount: '40000', bankAccountId: bank.id, withdrawalPin: TEST_WITHDRAWAL_PIN, clientRequestId: randomUUID(),
    });
    expect(request.status).toBe('PENDING');

    for (const adminId of [adminOne, adminTwo]) {
      const [notification] = await db.select().from(notifications).where(and(
        eq(notifications.userId, adminId),
        eq(notifications.type, 'ADMIN_PAYOUT_PENDING'),
        eq(notifications.resourceId, request.id),
      ));
      expect(notification).toBeTruthy();
      const detail = await asUser(adminId).get(`/api/v1/notifications/${notification.id}`);
      expect(detail.body.data.resourcePath).toBe(`/admin/wallet/payouts?payoutId=${request.id}`);
    }

    await setAutoApprove(true);
    try {
      await ensureWithdrawalPin(player);
      const auto = await walletPayoutService.createRequest(player, {
        requestType: 'WITHDRAWAL', amount: '10000', bankAccountId: bank.id, withdrawalPin: TEST_WITHDRAWAL_PIN, clientRequestId: randomUUID(),
      });
      expect(auto.status).toBe('APPROVED');
      expect(await db.select().from(notifications).where(and(
        eq(notifications.type, 'ADMIN_PAYOUT_PENDING'),
        eq(notifications.resourceId, auto.id),
      ))).toHaveLength(0);
    } finally {
      await setAutoApprove(false);
    }
  });

  it('notifies Admins when a refund fails and links to the refund queue', async () => {
    const [facility] = await db.insert(facilities).values({
      ownerId: owner, name: 'Refund Court', phone: '0900000000', status: 'ACTIVE', address: '1 Test',
      district: 'Q1', city: 'HCM', openingTime: '06:00:00', closingTime: '22:00:00',
    }).returning();
    const [court] = await db.insert(courts).values({ facilityId: facility.id, name: 'Court 1', status: 'ACTIVE' }).returning();
    const [booking] = await db.insert(bookings).values({
      playerId: player, courtId: court.id, bookingDate: '2026-12-01', startTime: '18:00:00', endTime: '19:00:00',
      unitPrice: '100000', totalAmount: '100000', status: 'CANCELLED', bookingCode: `REF-${Date.now()}`,
    }).returning();
    const [payment] = await db.insert(payments).values({
      bookingId: booking.id, amount: '100000', provider: 'WALLET', paymentMethod: 'WALLET', status: 'FAILED',
    }).returning();
    await db.insert(paymentRefunds).values({ paymentId: payment.id, status: 'PENDING', reason: 'test' });

    await refundService.processPending();

    for (const adminId of [adminOne, adminTwo]) {
      const [notification] = await db.select().from(notifications).where(and(
        eq(notifications.userId, adminId),
        eq(notifications.type, 'ADMIN_REFUND_FAILED'),
        eq(notifications.resourceId, payment.id),
      ));
      expect(notification).toBeTruthy();
      const detail = await asUser(adminId).get(`/api/v1/notifications/${notification.id}`);
      expect(detail.body.data.resourcePath).toBe(`/admin/wallet/refunds?paymentId=${payment.id}`);
    }

    const list = await asUser(adminOne).get('/api/v1/admin/wallet/refunds?status=FAILED');
    expect(list.status).toBe(200);
    expect(list.body.data.map((row: { paymentId: number }) => row.paymentId)).toContain(payment.id);
    expect(list.body.meta).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });
    expect((await asUser(player).get('/api/v1/admin/wallet/refunds')).status).toBe(403);
  });

  it('alerts Admins on a webhook failure without changing the failing response', async () => {
    const previous = env.SEPAY_IPN_SECRET;
    env.SEPAY_IPN_SECRET = 'expected-secret';
    try {
      await expect(walletTopUpService.handleSepayWebhook({}, 'bad-secret'))
        .rejects.toMatchObject({ code: 'PAYMENT_SIGNATURE_INVALID' });
      for (const adminId of [adminOne, adminTwo]) {
        expect(await adminNotification(adminId, 'ADMIN_PAYMENT_MISMATCH')).toBeTruthy();
      }
    } finally {
      env.SEPAY_IPN_SECRET = previous;
    }
  });

  it('notifies other Admins, not the actor, when a system config changes', async () => {
    const response = await request(app)
      .patch('/api/v1/admin/configs/BOOKING_ENABLED')
      .set('x-user-id', String(adminOne))
      .send({ value: false });
    expect(response.status).toBe(200);

    const audit = (await db.select().from(systemConfigAudit).where(eq(systemConfigAudit.configKey, 'BOOKING_ENABLED')))[0];
    const [notification] = await db.select().from(notifications).where(and(
      eq(notifications.userId, adminTwo),
      eq(notifications.type, 'ADMIN_CONFIG_CHANGED'),
      eq(notifications.resourceId, audit.id),
    ));
    expect(notification).toBeTruthy();
    expect(await db.select().from(notifications).where(and(
      eq(notifications.userId, adminOne), eq(notifications.type, 'ADMIN_CONFIG_CHANGED'),
    ))).toHaveLength(0);

    const detail = await asUser(adminTwo).get(`/api/v1/notifications/${notification.id}`);
    expect(detail.body.data.resourcePath).toBe('/admin/configs?key=BOOKING_ENABLED');
    await db.delete(systemConfigs).where(eq(systemConfigs.configKey, 'BOOKING_ENABLED'));
  });

  it('emits one high-risk report alert per target window', async () => {
    const author = (await createTestUser({ role: 'PLAYER' })).id;
    const [post] = await db.insert(posts).values({
      authorId: author, type: 'FREE', body: 'high risk post', publishedAt: new Date(), creationHash: 'b'.repeat(64),
    }).returning();

    for (let index = 0; index < 5; index += 1) {
      const reporter = (await createTestUser({ role: 'PLAYER' })).id;
      const created = await asUser(reporter).post('/api/v1/reports', {
        targetType: 'POST', targetId: post.id, reasonCode: 'SPAM',
      });
      expect(created.status).toBe(201);
    }

    const alerts = await db.select().from(notifications).where(and(
      eq(notifications.userId, adminOne),
      eq(notifications.type, 'ADMIN_HIGH_RISK_REPORT'),
    ));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].content).toContain('5 người report');
  });

  it('notifies other Admins on Admin account creation and password reset', async () => {
    const created = await asUser(adminOne).post('/api/v1/admin/users', {
      email: `new-admin-${Date.now()}@example.com`, password: 'AdminPassword123!', role: 'ADMIN',
    });
    expect(created.status).toBe(201);
    const newAdminId = created.body.data.id;

    for (const adminId of [adminTwo]) {
      const [notification] = await db.select().from(notifications).where(and(
        eq(notifications.userId, adminId),
        eq(notifications.type, 'ADMIN_SECURITY_EVENT'),
        eq(notifications.resourceId, newAdminId),
      ));
      expect(notification).toBeTruthy();
      const detail = await asUser(adminId).get(`/api/v1/notifications/${notification.id}`);
      expect(detail.body.data.resourcePath).toBe(`/admin/users?userId=${newAdminId}`);
    }
    expect(await db.select().from(notifications).where(and(
      eq(notifications.userId, adminOne), eq(notifications.type, 'ADMIN_SECURITY_EVENT'),
    ))).toHaveLength(0);

    const reset = await asUser(adminOne).post(`/api/v1/admin/users/${newAdminId}/password`)
      .send({ reason: 'Security check' });
    expect(reset.status).toBe(200);
    expect((await db.select().from(notifications).where(and(
      eq(notifications.userId, adminTwo), eq(notifications.type, 'ADMIN_SECURITY_EVENT'),
    ))).length).toBeGreaterThanOrEqual(2);
  });

  it('notifies Admins when an owner submits a facility for approval and links to the pending queue', async () => {
    const created = await asUser(owner).post('/api/v1/owner/facilities', {
      name: 'Sân Chờ Duyệt', address: '1 Đường A', district: 'Q1', city: 'HCM',
      phone: '0900000000',
      openingTime: '06:00', closingTime: '22:00',
    });
    expect(created.status).toBe(201);

    for (const adminId of [adminOne, adminTwo]) {
      const notification = await adminNotification(adminId, 'ADMIN_FACILITY_SUBMITTED');
      expect(notification).not.toBeNull();
      expect(notification!.resourceType).toBe('ADMIN_FACILITY');
      expect(notification!.resourceId).toBe(created.body.data.id);

      const detail = await asUser(adminId).get(`/api/v1/notifications/${notification!.id}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.resourcePath).toBe('/admin/courts?status=PENDING_APPROVAL');
    }

    expect(await adminNotification(player, 'ADMIN_FACILITY_SUBMITTED')).toBeNull();
  });
});
