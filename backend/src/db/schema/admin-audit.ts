import { sql } from 'drizzle-orm';
import { bigint, check, index, jsonb, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

/** Audit trail for sensitive Admin actions on a user account (email OTP plan §3.5). */
export const adminActionAudits = pgTable(
  'admin_action_audits',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    adminId: bigint('admin_id', { mode: 'number' }).notNull().references(() => users.id),
    targetUserId: bigint('target_user_id', { mode: 'number' }).notNull().references(() => users.id),
    action: varchar('action', { length: 50 }).notNull(),
    reason: varchar('reason', { length: 500 }).notNull(),
    result: varchar('result', { length: 20 }).notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    check(
      'chk_admin_action_audits_result',
      sql`${table.result} IN ('SUCCESS', 'FAILED')`
    ),
    index('admin_action_audits_target_created_idx').on(table.targetUserId, table.createdAt),
    index('admin_action_audits_admin_created_idx').on(table.adminId, table.createdAt),
  ]
);
