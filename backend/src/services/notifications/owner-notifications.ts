import { and, eq, isNull } from 'drizzle-orm';
import type { NotificationResourceRef } from '../../contracts/NotificationService';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { users } from '../../db/schema/users';
import { bookingRepository } from '../../repositories/booking/BookingRepository';
import { ownerCourtRepository } from '../../repositories/owner/OwnerCourtRepository';
import { ownerFacilityRepository } from '../../repositories/owner/OwnerFacilityRepository';
import { walletRepository } from '../../repositories/wallet/WalletRepository';
import type { OwnerEarningSettlementRecord } from '../../repositories/finance/OwnerEarningSettlementRepository';
import { notificationService } from './NotificationService';

// Court Owner inbox producers. The recipient is resolved inside the caller's
// transaction so the notification commits or rolls back with the domain change.
// Ownership/role is never decided from caller input.

export interface OwnerNotificationInput {
  type: string;
  title: string;
  content: string;
  resource?: NotificationResourceRef | null;
  dedupKey: string;
}

export async function notifyOwner(
  tx: TransactionContext,
  recipientId: number,
  input: OwnerNotificationInput,
): Promise<void> {
  const [recipient] = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, recipientId), isNull(users.deletedAt)))
    .limit(1);
  if (!recipient) return;
  await notificationService.notify(tx, [{
    recipientId: recipient.id,
    type: input.type,
    title: input.title,
    content: input.content,
    resource: input.resource ?? null,
    dedupKey: input.dedupKey,
  }]);
}

export async function notifyBookingOwner(
  tx: TransactionContext,
  bookingId: number,
  input: OwnerNotificationInput,
): Promise<void> {
  const context = await bookingRepository.findBookingNotificationContext(bookingId, tx);
  if (!context) return;
  await notifyOwner(tx, context.ownerId, input);
}

export async function notifyPayoutOwner(
  tx: TransactionContext,
  payoutId: number,
  input: OwnerNotificationInput,
): Promise<void> {
  const payout = await walletRepository.findPayoutRequest(payoutId, tx);
  if (!payout || payout.requestType !== 'OWNER_PAYOUT') return;
  await notifyOwner(tx, payout.userId, input);
}

export async function notifyOwnerEarning(
  tx: TransactionContext,
  settlement: OwnerEarningSettlementRecord,
  input: OwnerNotificationInput,
): Promise<void> {
  await notifyOwner(tx, settlement.ownerId, input);
}

export async function notifyFacilityOwner(
  tx: TransactionContext,
  facilityId: number,
  ownerId: number,
  input: OwnerNotificationInput,
): Promise<void> {
  const facility = await ownerFacilityRepository.find(ownerId, facilityId, tx);
  if (!facility) return;
  await notifyOwner(tx, facility.ownerId, input);
}

export async function notifyCourtOwner(
  tx: TransactionContext,
  courtId: number,
  ownerId: number,
  input: OwnerNotificationInput,
): Promise<void> {
  const court = await ownerCourtRepository.find(ownerId, courtId, tx);
  if (!court) return;
  await notifyOwner(tx, court.facility.ownerId, input);
}

/**
 * Free-text from a Player must never leak contact details or an unbounded body
 * into an Owner notification. Returns undefined when nothing useful remains.
 */
export function cleanNotificationReason(value: string | null | undefined, maxLength = 300): string | undefined {
  if (!value) return undefined;
  const cleaned = value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' ')
    .replace(/(?:\+?84|0)(?:[\s.-]?\d){9,10}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
    .trim();
  return cleaned.length > 0 ? cleaned : undefined;
}
