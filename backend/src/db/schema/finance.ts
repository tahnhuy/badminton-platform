import { bigint, index, jsonb, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Append-only audit for Admin finance actions. This deliberately does not reuse
 * `system_config_audit`: finance actions include exports, refund retries, payout
 * decisions, wallet adjustments, Owner settlement sweeps, and reconciliation
 * resolutions.
 */
export const financeAuditEvents = pgTable('finance_audit_events', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  actorId: bigint('actor_id', { mode: 'number' }).notNull().references(() => users.id),
  action: varchar('action', { length: 40 }).notNull(),
  entityType: varchar('entity_type', { length: 40 }).notNull(),
  entityId: varchar('entity_id', { length: 80 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  financeAuditActorCreatedIdx: index('finance_audit_actor_created_idx').on(t.actorId, t.createdAt),
  financeAuditEntityIdx: index('finance_audit_entity_idx').on(t.entityType, t.entityId),
  financeAuditActionCreatedIdx: index('finance_audit_action_created_idx').on(t.action, t.createdAt),
}));
