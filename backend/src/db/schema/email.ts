import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * Transactional mail outbox (email OTP plan §4). A background job sends rows
 * outside the DB transaction, retries a bounded number of times and reuses the
 * same idempotency key so a retry cannot produce a duplicate email.
 */
export const emailOutbox = pgTable(
  'email_outbox',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    idempotencyKey: varchar('idempotency_key', { length: 200 }).notNull().unique(),
    toEmail: varchar('to_email', { length: 254 }).notNull(),
    template: varchar('template', { length: 50 }).notNull(),
    payload: jsonb('payload').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('PENDING'),
    attempts: integer('attempts').notNull().default(0),
    providerMessageId: varchar('provider_message_id', { length: 200 }),
    lastError: varchar('last_error', { length: 500 }),
    nextAttemptAt: timestamp('next_attempt_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    sentAt: timestamp('sent_at'),
  },
  (table) => [
    check(
      'chk_email_outbox_status',
      sql`${table.status} IN ('PENDING', 'SENDING', 'SENT', 'FAILED')`
    ),
    check('chk_email_outbox_attempts', sql`${table.attempts} >= 0`),
    index('email_outbox_status_next_idx').on(table.status, table.nextAttemptAt),
    index('email_outbox_created_idx').on(table.createdAt),
  ]
);
