import { PgTransaction } from 'drizzle-orm/pg-core';
import type {
  NotificationEvent, NotificationService, NotifyResult,
} from '../../contracts/NotificationService';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { notificationRepository, NotificationInsertRow } from '../../repositories/notifications/NotificationRepository';

// NTF-02: transaction-aware persistence (Notifications Tech Design). Producers
// (MM-31, SOC-06, …) call notify() inside their own state-transition transaction.

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function positiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function toRow(event: NotificationEvent): NotificationInsertRow {
  if (!positiveId(event.recipientId)) throw new Error('Notification recipientId must be a positive integer');
  if (!nonEmpty(event.type) || !nonEmpty(event.title) || typeof event.content !== 'string') {
    throw new Error('Notification type, title and content are required');
  }
  if (!nonEmpty(event.dedupKey)) throw new Error('Notification dedupKey is required');
  const resource = event.resource ?? null;
  if (resource && (!nonEmpty(resource.type) || !positiveId(resource.id))) {
    throw new Error('Notification resource requires a type and a positive id');
  }
  return {
    userId: event.recipientId,
    type: event.type,
    title: event.title,
    content: event.content,
    resourceType: resource?.type ?? null,
    resourceId: resource?.id ?? null,
    dedupKey: event.dedupKey,
  };
}

export class TransactionalNotificationService implements NotificationService {
  async notify(tx: TransactionContext, events: readonly NotificationEvent[]): Promise<NotifyResult> {
    // Refuse the root database handle: inserting outside the caller's transaction
    // would commit notifications independently of the domain state.
    if (!(tx instanceof PgTransaction)) {
      throw new Error('NotificationService.notify requires the caller transaction');
    }
    const rows = events.map(toRow);
    // Deterministic insert order keeps unique-index lock acquisition consistent
    // across concurrent producers notifying overlapping recipient sets.
    rows.sort((a, b) => a.userId - b.userId || (a.dedupKey < b.dedupKey ? -1 : a.dedupKey > b.dedupKey ? 1 : 0));
    const insertedIds = await notificationRepository.insertSkippingDuplicates(tx, rows);
    return { insertedIds, duplicateCount: rows.length - insertedIds.length };
  }
}

export const notificationService: NotificationService = new TransactionalNotificationService();
