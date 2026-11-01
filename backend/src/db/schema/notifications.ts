import { sql } from 'drizzle-orm';
import { pgTable, bigint, varchar, timestamp, text, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

export const notifications = pgTable('notifications', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id),
  type: varchar('type').notNull(),
  title: varchar('title').notNull(),
  content: text('content').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  // database-schema.md §3.24 (NTF-01): application-validated resource reference and dedup key.
  resourceType: varchar('resource_type'),
  resourceId: bigint('resource_id', { mode: 'number' }),
  dedupKey: varchar('dedup_key'),
}, t => ({
  userDedupKey: uniqueIndex('uq_notifications_user_dedup_key')
    .on(t.userId, t.dedupKey)
    .where(sql`${t.dedupKey} IS NOT NULL`),
  userReadCreated: index('notifications_user_read_created_idx').on(t.userId, t.isRead, t.createdAt, t.id),
}));
