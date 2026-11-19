import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import {
  db, pool, users, playerProfiles, skillLevels, facilities, courts, bookings,
  payments, paymentRefunds, reports, systemConfigAudit, walletBankAccounts, walletPayoutRequests,
} from './index';
import { hashPassword } from '../utils/password';
import { walletService } from '../services/payments/WalletService';
import { walletRepository } from '../repositories/wallet/WalletRepository';
import { notificationService } from '../services/notifications/NotificationService';

// Local demo fixtures for the Admin notification inbox. Re-running is idempotent:
// users/resources are reused by stable keys and notification dedup keys are fixed.

const PASSWORD = 'Password@123';
const SEED = 'seed-admin-notif:v1';

async function ensureUser(input: {
  email: string;
  role: 'PLAYER' | 'COURT_OWNER' | 'ADMIN';
  passwordHash: string;
  fullName?: string;
  skillLevelId?: number;
}): Promise<number> {
  await db.insert(users).values({
    email: input.email,
    passwordHash: input.passwordHash,
    role: input.role,
    status: 'ACTIVE',
  }).onConflictDoNothing({ target: users.email });
  const [user] = await db.select().from(users).where(eq(users.email, input.email));
  if (!user || user.role !== input.role || user.status !== 'ACTIVE' || user.deletedAt) {
    throw new Error(`Demo account unavailable: ${input.email}`);
  }
  if (input.role === 'PLAYER' && input.fullName && input.skillLevelId) {
    await db.insert(playerProfiles).values({
      userId: user.id,
      fullName: input.fullName,
      skillLevelId: input.skillLevelId,
    }).onConflictDoNothing();
  }
  return user.id;
}

async function ensureFacility(ownerId: number): Promise<typeof facilities.$inferSelect> {
  const name = 'Cơ sở demo chờ duyệt';
  const [existing] = await db.select().from(facilities)
    .where(and(eq(facilities.ownerId, ownerId), eq(facilities.name, name)))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(facilities).values({
    ownerId,
    name,
    phone: '0909123456',
    status: 'PENDING_APPROVAL',
    address: '123 Đường Demo',
    ward: 'Phường 1',
    district: 'Quận 1',
    city: 'TP. Hồ Chí Minh',
    latitude: '10.7769',
    longitude: '106.7009',
    openingTime: '06:00:00',
    closingTime: '22:00:00',
  }).returning();
  return created;
}

async function ensureCourt(facilityId: number): Promise<typeof courts.$inferSelect> {
  const name = 'Sân demo hoàn tiền';
  const [existing] = await db.select().from(courts)
    .where(and(eq(courts.facilityId, facilityId), eq(courts.name, name)))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(courts).values({
    facilityId,
    name,
    status: 'ACTIVE',
  }).returning();
  return created;
}

async function ensureBooking(playerId: number, courtId: number): Promise<typeof bookings.$inferSelect> {
  const bookingCode = 'SEED-ADMINNOTIF-REFUND';
  const [existing] = await db.select().from(bookings)
    .where(eq(bookings.bookingCode, bookingCode))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(bookings).values({
    playerId,
    courtId,
    bookingDate: '2026-12-01',
    startTime: '18:00:00',
    endTime: '19:00:00',
    unitPrice: '100000',
    totalAmount: '100000',
    status: 'CANCELLED',
    bookingCode,
    cancellationReason: 'Seed admin notification demo',
    cancelledAt: new Date(),
  }).returning();
  return created;
}

async function ensureFailedRefund(bookingId: number): Promise<typeof payments.$inferSelect> {
  const [existingPayment] = await db.select().from(payments)
    .where(eq(payments.bookingId, bookingId))
    .limit(1);
  const payment = existingPayment ?? (await db.insert(payments).values({
    bookingId,
    amount: '100000',
    provider: 'WALLET',
    paymentMethod: 'WALLET',
    status: 'FAILED',
  }).returning())[0];

  await db.insert(paymentRefunds).values({
    paymentId: payment.id,
    status: 'FAILED',
    attempts: 3,
    lastError: 'Seed demo: ví đích không khả dụng',
    reason: 'Huỷ booking demo',
  }).onConflictDoUpdate({
    target: paymentRefunds.paymentId,
    set: {
      status: 'FAILED',
      attempts: 3,
      lastError: 'Seed demo: ví đích không khả dụng',
      updatedAt: new Date(),
    },
  });
  return payment;
}

async function ensurePayout(playerId: number): Promise<typeof walletPayoutRequests.$inferSelect> {
  const accountNumber = '0123456789';
  const bankCode = 'MBBank';
  await db.insert(walletBankAccounts).values({
    userId: playerId,
    bankCode,
    accountNumber,
    accountName: 'NGUYEN VAN DEMO',
    isDefault: true,
  }).onConflictDoNothing({
    target: [walletBankAccounts.userId, walletBankAccounts.bankCode, walletBankAccounts.accountNumber],
  });
  const [bank] = await db.select().from(walletBankAccounts).where(and(
    eq(walletBankAccounts.userId, playerId),
    eq(walletBankAccounts.bankCode, bankCode),
    eq(walletBankAccounts.accountNumber, accountNumber),
  )).limit(1);
  if (!bank) throw new Error('Seed bank account is unavailable');

  await walletService.credit({
    userId: playerId,
    amount: '500000',
    entryType: 'TOP_UP',
    idempotencyKey: `${SEED}:credit:${playerId}`,
    description: 'Seed admin notification demo credit',
  });

  let [payout] = await db.select().from(walletPayoutRequests).where(and(
    eq(walletPayoutRequests.userId, playerId),
    eq(walletPayoutRequests.requestType, 'WITHDRAWAL'),
  )).limit(1);
  if (!payout) {
    [payout] = await db.insert(walletPayoutRequests).values({
      userId: playerId,
      requestType: 'WITHDRAWAL',
      amount: '250000',
      status: 'PENDING',
      bankAccountId: bank.id,
    }).returning();
  }
  if (!payout.holdId) {
    const held = await walletService.hold({
      userId: playerId,
      amount: payout.amount,
      referenceType: 'WITHDRAWAL',
      referenceId: payout.id,
      idempotencyKey: `payout-hold:${payout.id}`,
    });
    [payout] = [await walletRepository.setPayoutHold(payout.id, held.hold.id)];
  }
  return payout;
}

async function seed() {
  if (process.env.NODE_ENV === 'production') throw new Error('Admin notification demo is for local development only');
  const connection = new URL(process.env.DATABASE_URL || process.env.DIRECT_URL || '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(connection.hostname)) {
    throw new Error('Admin notification demo requires a local PostgreSQL database');
  }

  const lock = await pool.connect();
  try {
    await lock.query('SELECT pg_advisory_lock(64102822)');

    const [skill] = await db.select().from(skillLevels).limit(1);
    if (!skill) throw new Error('Run db:migrate/db:seed first: a skill level is required');
    const passwordHash = await hashPassword(PASSWORD);

    const adminOne = await ensureUser({ email: 'admin-notif.one@example.com', role: 'ADMIN', passwordHash });
    const adminTwo = await ensureUser({ email: 'admin-notif.two@example.com', role: 'ADMIN', passwordHash });
    const player = await ensureUser({
      email: 'admin-notif.player@example.com', role: 'PLAYER', passwordHash,
      fullName: 'Admin Notif Player', skillLevelId: skill.id,
    });
    const reportedPlayer = await ensureUser({
      email: 'admin-notif.reported@example.com', role: 'PLAYER', passwordHash,
      fullName: 'Admin Notif Reported', skillLevelId: skill.id,
    });
    const owner = await ensureUser({ email: 'admin-notif.owner@example.com', role: 'COURT_OWNER', passwordHash });

    const facility = await ensureFacility(owner);
    const court = await ensureCourt(facility.id);
    const booking = await ensureBooking(player, court.id);
    const payment = await ensureFailedRefund(booking.id);
    const payout = await ensurePayout(player);

    const [existingReport] = await db.select().from(reports).where(and(
      eq(reports.reporterId, player),
      eq(reports.reportedPlayerId, reportedPlayer),
      eq(reports.reasonCode, 'SPAM'),
    )).limit(1);
    const report = existingReport ?? (await db.insert(reports).values({
      reporterId: player,
      reportedPlayerId: reportedPlayer,
      reasonCode: 'SPAM',
      description: 'Seed demo: nội dung bị nhiều người báo cáo.',
      status: 'OPEN',
    }).returning())[0];

    let [audit] = await db.select().from(systemConfigAudit).where(and(
      eq(systemConfigAudit.configKey, 'BOOKING_ENABLED'),
      eq(systemConfigAudit.oldValue, 'SEED_ADMIN_NOTIFICATION'),
    )).limit(1);
    if (!audit) {
      [audit] = await db.insert(systemConfigAudit).values({
        configKey: 'BOOKING_ENABLED',
        oldValue: 'SEED_ADMIN_NOTIFICATION',
        newValue: 'true',
        changedBy: adminOne,
      }).returning();
    }

    const recipients = [adminOne, adminTwo];
    const event = (
      recipientId: number, type: string, title: string, content: string,
      resourceType: string, resourceId: number, dedupKey: string,
    ) => ({ recipientId, type, title, content, resource: { type: resourceType, id: resourceId }, dedupKey });

    const events = [
      ...recipients.map(id => event(
        id, 'ADMIN_REPORT_CREATED', 'Báo cáo mới cần xử lý',
        `Báo cáo #${report.id} (PLAYER) với lý do SPAM đang chờ Admin xem xét.`,
        'ADMIN_REPORT', report.id, `${SEED}:report:${report.id}`,
      )),
      ...recipients.map(id => event(
        id, 'ADMIN_HIGH_RISK_REPORT', 'Báo cáo rủi ro cao',
        `PLAYER #${reportedPlayer} có 5 người report trong 24 giờ.`,
        'ADMIN_REPORT', report.id, `${SEED}:high-risk:${report.id}`,
      )),
      ...recipients.map(id => event(
        id, 'ADMIN_FACILITY_SUBMITTED', 'Hồ sơ cơ sở mới chờ duyệt',
        `Cơ sở "${facility.name}" đang chờ Admin duyệt.`,
        'ADMIN_FACILITY', facility.id, `${SEED}:facility:${facility.id}`,
      )),
      ...recipients.map(id => event(
        id, 'ADMIN_PAYOUT_PENDING', 'Yêu cầu rút ví chờ duyệt',
        `Người chơi #${player} yêu cầu 250.000đ, mã #${payout.id}, đang chờ Admin xử lý.`,
        'ADMIN_PAYOUT', payout.id, `${SEED}:payout:${payout.id}`,
      )),
      ...recipients.map(id => event(
        id, 'ADMIN_PAYOUT_FAILED', 'Payout thất bại cần kiểm tra',
        `SEPAY_PAYOUT/#${payout.id}: webhook payout sai số tiền (PAYMENT_AMOUNT_MISMATCH).`,
        'ADMIN_PAYOUT', payout.id, `${SEED}:payout-failed:${payout.id}`,
      )),
      ...recipients.map(id => event(
        id, 'ADMIN_REFUND_FAILED', 'Hoàn tiền thất bại cần xử lý',
        `Khoản hoàn tiền cho payment #${payment.id} thất bại: ví đích không khả dụng.`,
        'ADMIN_REFUND', payment.id, `${SEED}:refund:${payment.id}`,
      )),
      ...recipients.map(id => event(
        id, 'ADMIN_PAYMENT_MISMATCH', 'Lỗi thanh toán cần kiểm tra',
        `SEPAY_BANK: webhook top-up lệch số tiền (PAYMENT_AMOUNT_MISMATCH).`,
        'ADMIN_PAYMENT', payment.id, `${SEED}:payment-mismatch:${payment.id}`,
      )),
      ...recipients.map(id => event(
        id, 'ADMIN_CONFIG_CHANGED', 'Cấu hình hệ thống vừa thay đổi',
        'BOOKING_ENABLED: false → true',
        'ADMIN_CONFIG_AUDIT', audit.id, `${SEED}:config:${audit.id}`,
      )),
      event(
        adminTwo, 'ADMIN_SECURITY_EVENT', 'Mật khẩu Admin vừa được đặt lại',
        `Mật khẩu của tài khoản Admin admin-notif.one@example.com (#${adminOne}) vừa được đặt lại.`,
        'ADMIN_USER', adminOne, `${SEED}:security:${adminOne}`,
      ),
    ];

    await db.transaction(tx => notificationService.notify(tx, events));

    console.log(JSON.stringify({
      password: PASSWORD,
      accounts: {
        adminOne: 'admin-notif.one@example.com',
        adminTwo: 'admin-notif.two@example.com',
        player: 'admin-notif.player@example.com',
        owner: 'admin-notif.owner@example.com',
      },
      ids: {
        adminOne, adminTwo, player, reportedPlayer, owner,
        facilityId: facility.id, courtId: court.id, bookingId: booking.id,
        paymentId: payment.id, payoutId: payout.id, reportId: report.id,
        configAuditId: audit.id,
      },
      seededTypes: [
        'ADMIN_REPORT_CREATED', 'ADMIN_HIGH_RISK_REPORT', 'ADMIN_FACILITY_SUBMITTED',
        'ADMIN_PAYOUT_PENDING', 'ADMIN_PAYOUT_FAILED', 'ADMIN_REFUND_FAILED',
        'ADMIN_PAYMENT_MISMATCH', 'ADMIN_CONFIG_CHANGED', 'ADMIN_SECURITY_EVENT',
      ],
      note: 'Đăng nhập admin-notif.two@example.com để thấy tất cả mẫu; admin-notif.one nhận tất cả trừ ADMIN_SECURITY_EVENT.',
      adminApi: {
        notifications: 'GET /api/v1/notifications',
        unread: 'GET /api/v1/notifications/unread',
        payouts: 'GET /api/v1/admin/wallet/payouts',
        refunds: 'GET /api/v1/admin/wallet/refunds?status=FAILED',
      },
    }, null, 2));
  } finally {
    await lock.query('SELECT pg_advisory_unlock(64102822)');
    lock.release();
  }
}

seed().catch(error => {
  console.error(error instanceof Error ? error.message : 'Admin notification demo seed failed');
  process.exitCode = 1;
}).finally(() => pool.end());
