import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  db,
  bookings,
  courtOwnerReviews,
  courtPricings,
  courts,
  facilities,
  notifications,
  ownerEarningSettlements,
  systemConfigs,
} from '../db';
import { createTestUser, TEST_WITHDRAWAL_PIN, ensureWithdrawalPin } from './test-helpers';
import { bookingService } from '../services/booking/booking.service';
import { paymentService } from '../services/payments/payment.service';
import { walletService } from '../services/payments/WalletService';
import { walletPayoutService } from '../services/payments/WalletPayoutService';
import { ownerEarningService } from '../services/finance/OwnerEarningService';
import { refundService } from '../services/payments/RefundService';
import { facilityReviewService } from '../services/admin/FacilityReviewService';
import { notificationResourceResolver } from '../services/notifications/NotificationResourceResolver';
import { cleanNotificationReason } from '../services/notifications/owner-notifications';
import { financeConfig } from '../shared/config/finance-config';
import { clearConfigCache } from '../shared/config/config-registry';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';

const BOOKING_DATE = addDaysToDateString(todayInAppTimezone(), 2);
let sequence = 0;
const email = (label: string) => `${label}-${Date.now()}-${sequence++}@owner-notifications.test`;

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

async function fixture(options: { facilityStatus?: string; courtStatus?: string } = {}) {
  const owner = await createTestUser({ email: email('owner'), role: 'COURT_OWNER' });
  const player = await createTestUser({ email: email('player'), role: 'PLAYER' });
  const admin = await createTestUser({ email: email('admin'), role: 'ADMIN' });
  const [facility] = await db.insert(facilities).values({
    ownerId: owner.id,
    name: `Owner inbox ${sequence}`,
    phone: '0900000000',
    status: options.facilityStatus ?? 'ACTIVE',
    address: '1 Test',
    district: 'Quận 1',
    city: 'TP. Hồ Chí Minh',
    openingTime: '06:00:00',
    closingTime: '22:00:00',
  }).returning();
  const [court] = await db.insert(courts).values({
    facilityId: facility.id,
    name: `Sân ${sequence}`,
    status: options.courtStatus ?? 'ACTIVE',
  }).returning();
  await db.insert(courtPricings).values({ courtId: court.id, startTime: '06:00:00', endTime: '22:00:00', price: '100000', validFrom: '2020-01-01' });
  return { owner, player, admin, facility, court };
}

async function createBooking(playerId: number, courtId: number, overrides: Partial<typeof bookings.$inferInsert> = {}) {
  const [row] = await db.insert(bookings).values({
    playerId,
    courtId,
    bookingDate: BOOKING_DATE,
    startTime: '18:00:00',
    endTime: '19:00:00',
    unitPrice: '100000',
    totalAmount: '100000',
    status: 'PENDING_PAYMENT',
    bookingCode: `OWNER-NTF-${Date.now()}-${sequence++}`,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    ...overrides,
  }).returning();
  return row;
}

async function pay(playerId: number, bookingId: number) {
  await walletService.credit({ userId: playerId, amount: '100000', entryType: 'TOP_UP' });
  return paymentService.createBookingPayment({ bookingId, actorId: playerId, provider: 'WALLET' });
}

const ownerNotes = (ownerId: number, type: string, resourceId?: number) => db.select().from(notifications).where(and(
  eq(notifications.userId, ownerId),
  eq(notifications.type, type),
  ...(resourceId === undefined ? [] : [eq(notifications.resourceId, resourceId)]),
));

beforeEach(async () => {
  await setAutoCredit(true);
  await setAutoApprovePayouts(false);
});

describe('Owner notifications (P0)', () => {
  it('creates one booking-created notification for the facility Owner, not the Player', async () => {
    const { owner, player, facility, court } = await fixture();
    const booking = await createBooking(player.id, court.id);
    await pay(player.id, booking.id);

    const rows = await ownerNotes(owner.id, 'OWNER_BOOKING_CREATED', booking.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ resourceType: 'OWNER_BOOKING', dedupKey: `owner-booking-created:${booking.id}` });
    expect(rows[0].content).toContain(booking.bookingCode);
    expect(rows[0].content).not.toContain(player.email);
    expect(await ownerNotes(player.id, 'OWNER_BOOKING_CREATED', booking.id)).toHaveLength(0);
    expect(rows[0].content).toContain(facility.name);

    // Replaying payment/confirmation does not add a second notification.
    await paymentService.createBookingPayment({ bookingId: booking.id, actorId: player.id, provider: 'WALLET' });
    expect(await ownerNotes(owner.id, 'OWNER_BOOKING_CREATED', booking.id)).toHaveLength(1);
  });

  it('notifies the Owner when the Player cancels, but not when the Owner cancels', async () => {
    const { owner, player, court } = await fixture();
    const playerCancelled = await createBooking(player.id, court.id);
    await pay(player.id, playerCancelled.id);
    await bookingService.cancelBooking(player.id, playerCancelled.id);
    await bookingService.cancelBooking(player.id, playerCancelled.id);
    expect(await ownerNotes(owner.id, 'OWNER_BOOKING_CANCELLED', playerCancelled.id)).toHaveLength(1);

    const ownerCancelled = await createBooking(player.id, court.id);
    await pay(player.id, ownerCancelled.id);
    await bookingService.cancelBookingAsOwner(owner.id, ownerCancelled.id, 'Sân bảo trì');
    expect(await ownerNotes(owner.id, 'OWNER_BOOKING_CANCELLED', ownerCancelled.id)).toHaveLength(0);
  });

  it('redacts contact details from free-text notification reasons', () => {
    const cleaned = cleanNotificationReason('Gọi 0912345678 hoặc a@b.com để xử lý');
    expect(cleaned).not.toContain('0912345678');
    expect(cleaned).not.toContain('a@b.com');
    expect(cleanNotificationReason('Sân bảo trì')).toBe('Sân bảo trì');
  });

  it('notifies the Owner on payout approved, rejected and paid exactly once', async () => {
    const { owner, admin } = await fixture();
    await walletService.credit({ userId: owner.id, amount: '100000', entryType: 'TOP_UP' });
    const bank = await walletPayoutService.createBankAccount(owner.id, {
      bankCode: 'MBBank', accountNumber: '0123456789', accountName: 'NGUYEN VAN A',
    });
    await ensureWithdrawalPin(owner.id);
    const approvedRequest = await walletPayoutService.createRequest(owner.id, {
      requestType: 'OWNER_PAYOUT', amount: '30000', bankAccountId: bank.id, withdrawalPin: TEST_WITHDRAWAL_PIN, clientRequestId: randomUUID(),
    });
    expect(approvedRequest.status).toBe('PENDING');
    expect(await ownerNotes(owner.id, 'OWNER_PAYOUT_APPROVED', approvedRequest.id)).toHaveLength(0);

    await walletPayoutService.approve(approvedRequest.id, admin.id);
    await walletPayoutService.approve(approvedRequest.id, admin.id);
    await walletPayoutService.markPaid(approvedRequest.id, admin.id, 'OWNER-TX-1');
    await walletPayoutService.markPaid(approvedRequest.id, admin.id, 'OWNER-TX-1');
    expect(await ownerNotes(owner.id, 'OWNER_PAYOUT_APPROVED', approvedRequest.id)).toHaveLength(1);
    expect(await ownerNotes(owner.id, 'OWNER_PAYOUT_PAID', approvedRequest.id)).toHaveLength(1);

    await ensureWithdrawalPin(owner.id);

    const rejectedRequest = await walletPayoutService.createRequest(owner.id, {
      requestType: 'OWNER_PAYOUT', amount: '20000', bankAccountId: bank.id, withdrawalPin: TEST_WITHDRAWAL_PIN, clientRequestId: randomUUID(),
    });
    await walletPayoutService.reject(rejectedRequest.id, admin.id, 'Sai tài khoản');
    await walletPayoutService.reject(rejectedRequest.id, admin.id, 'Sai tài khoản');
    const [rejected] = await ownerNotes(owner.id, 'OWNER_PAYOUT_REJECTED', rejectedRequest.id);
    expect(rejected).toBeTruthy();
    expect(rejected.content).not.toContain('Sai tài khoản');
  });

  it('does not notify a Player withdrawal as an Owner payout', async () => {
    const { player, admin } = await fixture();
    await walletService.credit({ userId: player.id, amount: '100000', entryType: 'TOP_UP' });
    const bank = await walletPayoutService.createBankAccount(player.id, {
      bankCode: 'MBBank', accountNumber: '0123456789', accountName: 'NGUYEN VAN A',
    });
    await ensureWithdrawalPin(player.id);
    const request = await walletPayoutService.createRequest(player.id, {
      requestType: 'WITHDRAWAL', amount: '30000', bankAccountId: bank.id, withdrawalPin: TEST_WITHDRAWAL_PIN, clientRequestId: randomUUID(),
    });
    await walletPayoutService.approve(request.id, admin.id);
    expect(await ownerNotes(player.id, 'OWNER_PAYOUT_APPROVED', request.id)).toHaveLength(0);
  });
});

describe('Owner notifications (P1)', () => {
  it('notifies earning credited on auto credit and on manual Admin approval', async () => {
    const auto = await fixture();
    const autoBooking = await createBooking(auto.player.id, auto.court.id);
    await pay(auto.player.id, autoBooking.id);
    expect(await ownerNotes(auto.owner.id, 'OWNER_EARNING_CREDITED')).toHaveLength(1);

    await setAutoCredit(false);
    const manual = await fixture();
    const manualBooking = await createBooking(manual.player.id, manual.court.id);
    await pay(manual.player.id, manualBooking.id);
    expect(await ownerNotes(manual.owner.id, 'OWNER_EARNING_CREDITED')).toHaveLength(0);
    const [settlement] = await db.select().from(ownerEarningSettlements).where(eq(ownerEarningSettlements.bookingId, manualBooking.id));
    await ownerEarningService.approve(settlement.id, manual.admin.id);
    await ownerEarningService.approve(settlement.id, manual.admin.id);
    expect(await ownerNotes(manual.owner.id, 'OWNER_EARNING_CREDITED')).toHaveLength(1);
  });

  it('notifies earning reversed on manual reversal and on refund', async () => {
    const reversed = await fixture();
    const reversedBooking = await createBooking(reversed.player.id, reversed.court.id);
    await pay(reversed.player.id, reversedBooking.id);
    await ownerEarningService.reverse(reversedBooking.id, reversed.admin.id, 'Thu hồi thủ công');
    expect(await ownerNotes(reversed.owner.id, 'OWNER_EARNING_REVERSED')).toHaveLength(1);

    const refunded = await fixture();
    const refundedBooking = await createBooking(refunded.player.id, refunded.court.id);
    await pay(refunded.player.id, refundedBooking.id);
    await bookingService.cancelBooking(refunded.player.id, refundedBooking.id);
    await refundService.processPending();
    expect(await ownerNotes(refunded.owner.id, 'OWNER_EARNING_REVERSED')).toHaveLength(1);
  });

  it('notifies facility and court review decisions with the right resource', async () => {
    const facilityFixture = await fixture({ facilityStatus: 'PENDING_APPROVAL' });
    const [facilityReview] = await db.insert(courtOwnerReviews).values({
      facilityId: facilityFixture.facility.id,
      kind: 'ONBOARDING',
      submittedValues: { name: facilityFixture.facility.name },
      status: 'PENDING',
      submittedBy: facilityFixture.owner.id,
    }).returning();
    await facilityReviewService.decide(facilityFixture.admin.id, facilityFixture.facility.id, facilityReview.id, true, 'ONBOARDING');
    expect(await ownerNotes(facilityFixture.owner.id, 'OWNER_FACILITY_REVIEW_APPROVED', facilityFixture.facility.id)).toHaveLength(1);

    const rejectedFixture = await fixture({ facilityStatus: 'PENDING_APPROVAL' });
    const [rejectedReview] = await db.insert(courtOwnerReviews).values({
      facilityId: rejectedFixture.facility.id,
      kind: 'ONBOARDING',
      submittedValues: { name: rejectedFixture.facility.name },
      status: 'PENDING',
      submittedBy: rejectedFixture.owner.id,
    }).returning();
    await facilityReviewService.decide(rejectedFixture.admin.id, rejectedFixture.facility.id, rejectedReview.id, false, 'ONBOARDING', 'Thiếu giấy tờ');
    const [rejected] = await ownerNotes(rejectedFixture.owner.id, 'OWNER_FACILITY_REVIEW_REJECTED', rejectedFixture.facility.id);
    expect(rejected.content).toContain('Thiếu giấy tờ');

    const courtFixture = await fixture({ courtStatus: 'PENDING_APPROVAL' });
    const [courtReview] = await db.insert(courtOwnerReviews).values({
      courtId: courtFixture.court.id,
      kind: 'ONBOARDING',
      submittedValues: { name: courtFixture.court.name },
      status: 'PENDING',
      submittedBy: courtFixture.owner.id,
    }).returning();
    await facilityReviewService.decide(courtFixture.admin.id, courtFixture.facility.id, courtReview.id, true, 'ONBOARDING', undefined, courtFixture.court.id);
    expect(await ownerNotes(courtFixture.owner.id, 'OWNER_COURT_REVIEW_APPROVED', courtFixture.court.id)).toHaveLength(1);
  });
});

describe('Owner notification resolvers', () => {
  it('links booking, facility and court only for the owning Owner', async () => {
    const { owner, court, facility, player } = await fixture();
    const otherOwner = await createTestUser({ email: email('other-owner'), role: 'COURT_OWNER' });
    const booking = await createBooking(player.id, court.id);

    expect(await notificationResourceResolver.resolve({ id: owner.id, role: 'COURT_OWNER' }, 'OWNER_BOOKING', booking.id))
      .toBe(`/owner/schedule?facilityId=${facility.id}&bookingId=${booking.id}&date=${booking.bookingDate}`);
    expect(await notificationResourceResolver.resolve({ id: otherOwner.id, role: 'COURT_OWNER' }, 'OWNER_BOOKING', booking.id))
      .toBeNull();
    expect(await notificationResourceResolver.resolve({ id: owner.id, role: 'PLAYER' }, 'OWNER_BOOKING', booking.id))
      .toBeNull();
    expect(await notificationResourceResolver.resolve({ id: owner.id, role: 'COURT_OWNER' }, 'OWNER_FACILITY', facility.id))
      .toBe(`/owner/facilities?facilityId=${facility.id}`);
    expect(await notificationResourceResolver.resolve({ id: otherOwner.id, role: 'COURT_OWNER' }, 'OWNER_FACILITY', facility.id))
      .toBeNull();
    expect(await notificationResourceResolver.resolve({ id: owner.id, role: 'COURT_OWNER' }, 'OWNER_COURT', court.id))
      .toBe(`/owner/facilities?facilityId=${facility.id}&courtId=${court.id}`);
    expect(await notificationResourceResolver.resolve({ id: otherOwner.id, role: 'COURT_OWNER' }, 'OWNER_COURT', court.id))
      .toBeNull();
    await db.update(facilities).set({ deletedAt: new Date() }).where(eq(facilities.id, facility.id));
    expect(await notificationResourceResolver.resolve({ id: owner.id, role: 'COURT_OWNER' }, 'OWNER_BOOKING', booking.id))
      .toBeNull();
    expect(await notificationResourceResolver.resolve({ id: owner.id, role: 'COURT_OWNER' }, 'OWNER_FACILITY', facility.id))
      .toBeNull();
  });

  it('links payout and earning only for the owning Owner', async () => {
    const { owner, admin } = await fixture();
    const otherOwner = await createTestUser({ email: email('other-owner-earning'), role: 'COURT_OWNER' });
    await walletService.credit({ userId: owner.id, amount: '100000', entryType: 'TOP_UP' });
    const bank = await walletPayoutService.createBankAccount(owner.id, {
      bankCode: 'MBBank', accountNumber: '0123456789', accountName: 'NGUYEN VAN A',
    });
    await ensureWithdrawalPin(owner.id);
    const payout = await walletPayoutService.createRequest(owner.id, {
      requestType: 'OWNER_PAYOUT', amount: '30000', bankAccountId: bank.id, withdrawalPin: TEST_WITHDRAWAL_PIN, clientRequestId: randomUUID(),
    });
    expect(await notificationResourceResolver.resolve({ id: owner.id, role: 'COURT_OWNER' }, 'OWNER_PAYOUT', payout.id))
      .toBe('/owner/wallet');
    expect(await notificationResourceResolver.resolve({ id: otherOwner.id, role: 'COURT_OWNER' }, 'OWNER_PAYOUT', payout.id))
      .toBeNull();
    expect(await notificationResourceResolver.resolve({ id: admin.id, role: 'ADMIN' }, 'OWNER_PAYOUT', payout.id))
      .toBeNull();

    const bookingFixture = await fixture();
    const booking = await createBooking(bookingFixture.player.id, bookingFixture.court.id);
    await pay(bookingFixture.player.id, booking.id);
    const [settlement] = await db.select().from(ownerEarningSettlements).where(eq(ownerEarningSettlements.bookingId, booking.id));
    expect(await notificationResourceResolver.resolve({ id: bookingFixture.owner.id, role: 'COURT_OWNER' }, 'OWNER_EARNING', settlement.id))
      .toBe('/owner/wallet');
    expect(await notificationResourceResolver.resolve({ id: otherOwner.id, role: 'COURT_OWNER' }, 'OWNER_EARNING', settlement.id))
      .toBeNull();
  });
});
