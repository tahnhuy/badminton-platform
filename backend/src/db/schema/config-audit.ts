import { bigint, index, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

export const systemConfigAudit = pgTable('system_config_audit', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  configKey: varchar('config_key').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value').notNull(),
  changedBy: bigint('changed_by', { mode: 'number' }).references(() => users.id),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  configKeyChangedAtIdx: index('system_config_audit_key_changed_at_idx').on(t.configKey, t.changedAt),
}));
