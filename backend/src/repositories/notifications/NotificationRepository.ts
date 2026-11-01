import { and, count, desc, eq, sql, SQL } from 'drizzle-orm';
import { db } from '../../db';
import { notifications } from '../../db/schema/notifications';
import type { TransactionContext } from '../../contracts/TransactionContext';

export interface NotificationInsertRow {
  userId: number;
  type: string;
  title: string;
  content: string;
  resourceType: string | null;
  resourceId: number | null;
  dedupKey: string;
}

// Explicit read allowlist (Notifications Tech Design, NTF-03).
const readColumns = {
  id: notifications.id,
  type: notifications.type,
  title: notifications.title,
  content: notifications.content,
  resourceType: notifications.resourceType,
  resourceId: notifications.resourceId,
  isRead: notifications.isRead,
  readAt: notifications.readAt,
};

export type NotificationRecord = {
  id: number;
  type: string;
  title: string;
  content: string;
  resourceType: string | null;
  resourceId: number | null;
  isRead: boolean;
  readAt: Date | null;
};

function recipientScope(userId: number, isRead?: boolean): SQL {
  const conditions = [eq(notifications.userId, userId)];
  if (isRead !== undefined) conditions.push(eq(notifications.isRead, isRead));
  return and(...conditions)!;
}

export const notificationRepository = {
  /**
   * Inserts rows in the given transaction. A row whose (user_id, dedup_key) already
   * exists — committed, or inserted by a concurrent transaction that later commits —
   * is skipped via the partial unique index `uq_notifications_user_dedup_key`.
   */
  async insertSkippingDuplicates(tx: TransactionContext, rows: NotificationInsertRow[]): Promise<number[]> {
    if (rows.length === 0) return [];
    const inserted = await tx
      .insert(notifications)
      .values(rows)
      .onConflictDoNothing({
        target: [notifications.userId, notifications.dedupKey],
        where: sql`${notifications.dedupKey} IS NOT NULL`,
      })
      .returning({ id: notifications.id });
    return inserted.map(row => row.id);
  },

  /** Recipient-scoped page, newest `created_at`, then `id` first (index notifications_user_read_created_idx). */
  async listForRecipient(
    userId: number,
    filter: { isRead?: boolean; page: number; limit: number },
  ): Promise<{ rows: NotificationRecord[]; total: number }> {
    const where = recipientScope(userId, filter.isRead);
    const rows = await db
      .select(readColumns)
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(filter.limit)
      .offset((filter.page - 1) * filter.limit);
    const [{ total }] = await db.select({ total: count() }).from(notifications).where(where);
    return { rows, total: Number(total) };
  },

  async findForRecipient(userId: number, id: number): Promise<NotificationRecord | null> {
    const [row] = await db
      .select(readColumns)
      .from(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .limit(1);
    return row ?? null;
  },

  /** Idempotent: sets is_read once and keeps the first read_at. */
  async markReadForRecipient(userId: number, id: number): Promise<NotificationRecord | null> {
    const [row] = await db
      .update(notifications)
      .set({ isRead: true, readAt: sql`COALESCE(${notifications.readAt}, now())` })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning(readColumns);
    return row ?? null;
  },
};
