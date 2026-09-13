import { pgTable, bigint, varchar, timestamp, text } from 'drizzle-orm/pg-core';
import { users } from './users';

export const systemConfigs = pgTable('system_configs', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  configKey: varchar('config_key').notNull().unique(),
  configValue: text('config_value').notNull(),
  description: text('description'),
  updatedBy: bigint('updated_by', { mode: 'number' }).references(() => users.id),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
