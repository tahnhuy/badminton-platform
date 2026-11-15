import type { TransactionContext } from './TransactionContext';

/** Application-validated link target (database-schema.md §3.24). Values are registered by the owning modules. */
export interface NotificationResourceRef {
  type: string;
  id: number;
}

/** One notification for one recipient. Recipients and metadata are trusted server inputs. */
export interface NotificationEvent {
  recipientId: number;
  type: string;
  title: string;
  content: string;
  resource?: NotificationResourceRef | null;
  /**
   * Stable key identifying the event / entity transition / recipient
   * (Notifications Tech Design). UNIQUE per recipient, so a retried state
   * transition never produces a second notification.
   */
  dedupKey: string;
}

export interface NotifyResult {
  /** Ids of rows inserted by this call. */
  insertedIds: number[];
  /** Events skipped because (recipient, dedupKey) already exists. */
  duplicateCount: number;
}

export interface NotificationService {
  /**
   * Inserts notifications inside the caller's transaction so they commit or roll
   * back with the domain state. Never opens, commits or rolls back a transaction.
   * Insert failures propagate so the caller's transition is rolled back; a
   * notification is never silently dropped. Duplicates by (recipient, dedupKey)
   * are skipped, not errors.
   */
  notify(tx: TransactionContext, events: readonly NotificationEvent[]): Promise<NotifyResult>;
}
