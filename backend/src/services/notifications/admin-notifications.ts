import { and, eq, isNull, notInArray } from 'drizzle-orm';
import type { NotificationResourceRef } from '../../contracts/NotificationService';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { db } from '../../db';
import { users } from '../../db/schema/users';
import { logger } from '../../shared/logging/logger';
import { notificationService } from './NotificationService';

// Admin inbox producers. Admin recipients are resolved inside the caller's
// transaction so a notification never targets a deleted or deactivated account,
// and the notification commits or rolls back with the domain change.

export interface AdminNotificationInput {
  type: string;
  title: string;
  content: string;
  resource?: NotificationResourceRef | null;
  dedupKey: string;
  excludeUserIds?: readonly number[];
}

export async function findActiveAdminIds(
  tx: TransactionContext,
  excludeUserIds: readonly number[] = [],
): Promise<number[]> {
  const conditions = [
    eq(users.role, 'ADMIN'),
    eq(users.status, 'ACTIVE'),
    isNull(users.deletedAt),
  ];
  if (excludeUserIds.length > 0) {
    conditions.push(notInArray(users.id, [...excludeUserIds]));
  }
  const rows = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(...conditions));
  return rows.map(row => row.id);
}

export async function notifyAdmins(
  tx: TransactionContext,
  input: AdminNotificationInput,
): Promise<void> {
  const adminIds = await findActiveAdminIds(tx, input.excludeUserIds);
  if (adminIds.length === 0) return;
  await notificationService.notify(
    tx,
    adminIds.map(recipientId => ({
      recipientId,
      type: input.type,
      title: input.title,
      content: input.content,
      resource: input.resource ?? null,
      dedupKey: input.dedupKey,
    })),
  );
}

/**
 * Best-effort alert for flows that have already failed or completed outside a
 * transaction (webhook mismatches, Admin security events). Never throws back into
 * the caller; a failed alert is logged and the domain response is unchanged.
 */
export async function notifyAdminsBestEffort(input: AdminNotificationInput): Promise<boolean> {
  try {
    await db.transaction(tx => notifyAdmins(tx, input));
    return true;
  } catch (error) {
    logger.error('admin notification best-effort failed', {
      type: input.type,
      dedupKey: input.dedupKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
