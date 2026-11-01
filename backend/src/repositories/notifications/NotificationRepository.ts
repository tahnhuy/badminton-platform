import { sql } from 'drizzle-orm';
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
};
